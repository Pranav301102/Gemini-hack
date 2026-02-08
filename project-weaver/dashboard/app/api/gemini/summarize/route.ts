import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractApiKey, getModel } from '../../../lib/gemini';

export async function POST(request: Request) {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key' }, { status: 401 });
  }

  try {
    const { projectPath, stage } = await request.json();
    if (!projectPath || !stage) {
      return NextResponse.json({ error: 'projectPath and stage required' }, { status: 400 });
    }

    // Read context.json
    const contextPath = path.join(projectPath, '.weaver', 'context.json');
    let context: { entries?: { stage: string; type: string; title: string; content: string }[] };
    try {
      context = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
    } catch {
      return NextResponse.json({ error: 'Could not read context.json' }, { status: 404 });
    }

    const stageEntries = (context.entries ?? []).filter(e => e.stage === stage);
    if (stageEntries.length === 0) {
      return NextResponse.json({ summary: 'No entries found for this stage yet.', stage });
    }

    const entriesText = stageEntries.map(e =>
      `[${e.type}] ${e.title}:\n${e.content.substring(0, 1000)}`
    ).join('\n\n---\n\n');

    const prompt = `Summarize the following artifacts and decisions from the "${stage}" stage of a software development pipeline into a clear, 2-3 paragraph human-readable summary.

Focus on:
- Key decisions made and their rationale
- Main artifacts produced
- Any concerns or trade-offs
- What was accomplished

Be concise but informative. Use a professional tone.

Entries:
${entriesText}`;

    const model = getModel(apiKey);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
    });

    return NextResponse.json({ summary: result.response.text(), stage });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Summarization failed' }, { status: 500 });
  }
}
