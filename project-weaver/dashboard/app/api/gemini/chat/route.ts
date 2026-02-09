import { extractApiKey, getModel } from '../../../lib/gemini';
import { readProjectIndex, buildContextSummary } from '../../../lib/index-reader';

export async function POST(request: Request) {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { messages, projectPath } = await request.json();
    if (!projectPath || !messages?.length) {
      return new Response(JSON.stringify({ error: 'projectPath and messages required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const index = readProjectIndex(projectPath);
    let contextSummary = index ? buildContextSummary(index) : 'No code index available. Run index_project first.';
    // Truncate context to ~30k chars to stay within token limits
    if (contextSummary.length > 30000) {
      contextSummary = contextSummary.substring(0, 30000) + '\n\n... (context truncated for token limits)';
    }

    const systemInstruction = `You are a codebase expert assistant for Agent Weaver. You help developers understand and navigate their codebase.

Use the following codebase context to answer questions accurately. Reference specific file paths and function names. If you don't know something, say so.

${contextSummary}`;

    const model = getModel(apiKey);

    // Build chat history for Gemini
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;

    const chat = model.startChat({
      history,
      systemInstruction,
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    });

    const result = await chat.sendMessageStream(lastMessage);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Stream error' })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Chat failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
