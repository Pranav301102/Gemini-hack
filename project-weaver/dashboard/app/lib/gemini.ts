import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MODEL = 'gemini-2.0-flash';

export function getModel(apiKey: string, model = DEFAULT_MODEL) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}

export function extractApiKey(request: Request): string | null {
  const headerKey = request.headers.get('x-gemini-key');
  if (headerKey) return headerKey;
  return process.env.GEMINI_API_KEY || null;
}
