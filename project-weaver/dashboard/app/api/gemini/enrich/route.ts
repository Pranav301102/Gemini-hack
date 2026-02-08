import { NextResponse } from 'next/server';
import { getModel, extractApiKey } from '../../../lib/gemini';
import { readProjectIndex, writeProjectIndex, collectUnenrichedItems, extractCodeSnippet } from '../../../lib/index-reader';

export async function POST(request: Request) {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'No API key. Set it in Settings or via GEMINI_API_KEY env.' }, { status: 401 });
  }

  try {
    const { projectPath, batchSize = 15 } = await request.json();
    if (!projectPath) {
      return NextResponse.json({ success: false, error: 'projectPath is required' }, { status: 400 });
    }

    const index = readProjectIndex(projectPath);
    if (!index) {
      return NextResponse.json({ success: false, error: 'No index found. Run index_project first via Gemini CLI.' }, { status: 404 });
    }

    const size = Math.min(batchSize, 30);
    const { batch, totalItems, enrichedItems, remaining } = collectUnenrichedItems(index, size);

    if (batch.length === 0) {
      return NextResponse.json({
        success: true,
        progress: { total: totalItems, enriched: enrichedItems, remaining: 0 },
        message: 'All items are already enriched!',
      });
    }

    // Fill code snippets
    for (const item of batch) {
      if (item.line > 0) {
        item.codeSnippet = extractCodeSnippet(index.rootPath, item.file, item.line, item.kind);
      }
    }

    // Build enrichment prompt
    const itemsText = batch.map((item, i) => {
      const existing = item.existingDescription ? `\nExisting doc: ${item.existingDescription}` : '';
      return `### Item ${i + 1}\n- **File**: ${item.file}\n- **Name**: ${item.name}\n- **Kind**: ${item.kind}\n- **Signature**: ${item.signature}${existing}\n\`\`\`\n${item.codeSnippet}\n\`\`\``;
    }).join('\n\n');

    const prompt = `You are analyzing a codebase. For each code item below, write:
1. A concise one-line "description" of what it does
2. An optional "purpose" describing its role in the broader system

Return a JSON array with this exact format:
[{"file": "...", "name": "...", "kind": "...", "description": "...", "purpose": "..."}]

Return ONLY the JSON array, no markdown fences or other text.

${itemsText}`;

    const model = getModel(apiKey);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    });

    const responseText = result.response.text().trim();

    // Parse JSON — handle markdown fences if present
    let enrichments: { file: string; name: string; kind: string; description: string; purpose?: string }[];
    try {
      const cleaned = responseText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
      enrichments = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse Gemini response as JSON',
        rawResponse: responseText.substring(0, 500),
      }, { status: 500 });
    }

    // Apply enrichments to index
    let updated = 0;
    for (const enrichment of enrichments) {
      const file = index.files.find(f => f.path === enrichment.file);
      if (!file) continue;

      if (enrichment.kind === 'function') {
        const fn = file.functions.find(f => f.name === enrichment.name);
        if (fn) { fn.enrichedDescription = enrichment.description; if (enrichment.purpose) fn.purpose = enrichment.purpose; updated++; }
      } else if (enrichment.kind === 'class') {
        const cls = file.classes.find(c => c.name === enrichment.name);
        if (cls) { cls.enrichedDescription = enrichment.description; if (enrichment.purpose) cls.purpose = enrichment.purpose; updated++; }
      } else if (enrichment.kind === 'type') {
        const t = file.types.find(t => t.name === enrichment.name);
        if (t) { t.enrichedDescription = enrichment.description; updated++; }
      } else if (enrichment.kind === 'variable') {
        const v = file.variables.find(v => v.name === enrichment.name);
        if (v) { v.enrichedDescription = enrichment.description; updated++; }
      }
    }

    // Recount progress
    let newTotal = 0;
    let newEnriched = 0;
    for (const file of index.files) {
      for (const fn of file.functions) { newTotal++; if (fn.enrichedDescription) newEnriched++; }
      for (const cls of file.classes) { newTotal++; if (cls.enrichedDescription) newEnriched++; }
      for (const t of file.types) { newTotal++; if (t.enrichedDescription) newEnriched++; }
      for (const v of file.variables) { newTotal++; if (v.enrichedDescription) newEnriched++; }
    }

    index.enrichedAt = new Date().toISOString();
    index.enrichmentProgress = { totalItems: newTotal, enrichedItems: newEnriched };
    writeProjectIndex(projectPath, index);

    return NextResponse.json({
      success: true,
      progress: { total: newTotal, enriched: newEnriched, remaining: newTotal - newEnriched },
      updated,
      enriched: enrichments.slice(0, 5).map(e => `${e.name}: ${e.description}`),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Enrichment failed',
    }, { status: 500 });
  }
}
