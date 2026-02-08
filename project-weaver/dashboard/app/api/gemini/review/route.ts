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
    const { projectPath } = await request.json();
    if (!projectPath) {
      return NextResponse.json({ error: 'projectPath required' }, { status: 400 });
    }

    const contextPath = path.join(projectPath, '.weaver', 'context.json');
    let context: { entries?: { stage: string; type: string; title: string; content: string; metadata?: Record<string, unknown> }[] };
    try {
      context = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
    } catch {
      return NextResponse.json({ error: 'Could not read context.json' }, { status: 404 });
    }

    const entries = context.entries ?? [];
    const architecture = entries.filter(e => e.stage === 'architecture' && (e.type === 'artifact' || e.type === 'decision')).map(e => `[${e.type}] ${e.title}: ${e.content.substring(0, 2000)}`).join('\n\n');
    const spec = entries.filter(e => e.stage === 'spec' && e.type === 'artifact').map(e => `${e.title}: ${e.content.substring(0, 2000)}`).join('\n\n');
    const stories = entries.filter(e => e.stage === 'stories' && e.type === 'artifact').map(e => `${e.title}: ${e.content.substring(0, 2000)}`).join('\n\n');
    const styleGuide = entries.filter(e => e.type === 'decision' && e.metadata?.isStyleGuide === true).map(e => e.content.substring(0, 1000)).join('\n');

    if (!architecture && !spec && !stories) {
      return NextResponse.json({ error: 'No artifacts found to review. Complete architecture, spec, and stories stages first.' }, { status: 400 });
    }

    const prompt = `You are a senior tech lead reviewing a software project proposal before implementation begins.

Review the architecture, specification, and user stories below. Provide a structured assessment.

Return ONLY a JSON object with this exact structure (no markdown fences):
{
  "issues": [{"severity": "high|medium|low", "title": "...", "description": "..."}],
  "gaps": [{"area": "...", "description": "...", "recommendation": "..."}],
  "recommendations": [{"category": "architecture|security|performance|testing|ux", "title": "...", "description": "...", "priority": "high|medium|low"}],
  "overallAssessment": "2-3 sentence assessment",
  "readinessScore": 7
}

=== ARCHITECTURE ===
${architecture || '(not yet produced)'}

=== SPECIFICATION ===
${spec || '(not yet produced)'}

=== USER STORIES ===
${stories || '(not yet produced)'}

=== STYLE GUIDE ===
${styleGuide || '(not yet produced)'}`;

    const model = getModel(apiKey);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
    });

    const responseText = result.response.text().trim();
    let review;
    try {
      // Try direct parse first, then strip markdown fences
      try {
        review = JSON.parse(responseText);
      } catch {
        const cleaned = responseText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');
        review = JSON.parse(cleaned);
      }
    } catch {
      // Last resort: extract JSON object from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          review = JSON.parse(jsonMatch[0]);
        } catch {
          return NextResponse.json({ error: 'Failed to parse review response', rawResponse: responseText.substring(0, 500) }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'Failed to parse review response', rawResponse: responseText.substring(0, 500) }, { status: 500 });
      }
    }

    // Ensure expected fields exist with safe defaults
    review.issues = review.issues ?? [];
    review.gaps = review.gaps ?? [];
    review.recommendations = review.recommendations ?? [];
    review.overallAssessment = review.overallAssessment ?? 'No assessment provided.';
    review.readinessScore = typeof review.readinessScore === 'number' ? review.readinessScore : 5;

    return NextResponse.json(review);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Review failed' }, { status: 500 });
  }
}
