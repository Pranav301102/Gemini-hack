import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ valid: false, error: 'No API key provided' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    await model.countTokens('test');

    return NextResponse.json({ valid: true });
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid API key',
    });
  }
}
