import { NextResponse } from 'next/server';
import { extractApiKey, getModel } from '../../../lib/gemini';
import { readProjectIndex, extractCodeSnippet } from '../../../lib/index-reader';

export async function POST(request: Request) {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key' }, { status: 401 });
  }

  try {
    const { projectPath, filePath, itemName, itemKind } = await request.json();
    if (!projectPath || !filePath) {
      return NextResponse.json({ error: 'projectPath and filePath required' }, { status: 400 });
    }

    const index = readProjectIndex(projectPath);
    if (!index) {
      return NextResponse.json({ error: 'No code index found' }, { status: 404 });
    }

    const file = index.files.find(f => f.path === filePath || filePath.endsWith(f.path));
    if (!file) {
      return NextResponse.json({ error: `File not found in index: ${filePath}` }, { status: 404 });
    }

    // Build context about this file
    let codeSnippet = '';
    let itemContext = '';

    if (itemName && itemKind) {
      if (itemKind === 'function') {
        const fn = file.functions.find(f => f.name === itemName);
        if (fn) {
          codeSnippet = extractCodeSnippet(index.rootPath, file.path, fn.line, 'function');
          itemContext = `Function: ${fn.name}\nExisting description: ${fn.enrichedDescription || fn.description || 'none'}`;
        }
      } else if (itemKind === 'class') {
        const cls = file.classes.find(c => c.name === itemName);
        if (cls) {
          codeSnippet = extractCodeSnippet(index.rootPath, file.path, cls.line, 'class');
          itemContext = `Class: ${cls.name}\nExisting description: ${cls.enrichedDescription || cls.description || 'none'}`;
        }
      }
    }

    // File-level context
    const fileDesc = file.enrichedDescription || file.description || '';
    const functions = file.functions.map(f => `- ${f.name}: ${f.enrichedDescription || f.description || '(no description)'}`).join('\n');
    const classes = file.classes.map(c => `- ${c.name}: ${c.enrichedDescription || c.description || '(no description)'}`).join('\n');
    const imports = file.imports.map(i => `- ${i.source}: ${i.names.join(', ')}`).join('\n');

    const prompt = `Explain the following code file from a software project.

**File**: ${file.path} (${file.language}, ${file.size} bytes)
${fileDesc ? `**Description**: ${fileDesc}` : ''}
${itemContext ? `\n**Specific Item**:\n${itemContext}` : ''}

**Functions in this file**:
${functions || '(none)'}

**Classes in this file**:
${classes || '(none)'}

**Imports**:
${imports || '(none)'}

${codeSnippet ? `**Code**:\n\`\`\`\n${codeSnippet}\n\`\`\`\n` : ''}

Provide a clear, concise explanation covering:
1. What this ${itemName ? 'code item' : 'file'} does
2. How it fits in the project
3. Key patterns or techniques used
4. Important dependencies

Keep it to 2-3 paragraphs.`;

    const model = getModel(apiKey);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
    });

    return NextResponse.json({ explanation: result.response.text(), filePath: file.path, itemName });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Explanation failed' }, { status: 500 });
  }
}
