export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest } from 'next/server';

/**
 * Legacy plan endpoint - redirects to UGC agent
 * 
 * The assistant is now UGC-only, so all plan requests
 * are handled by the UGC agent instead.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, user_id } = body;
    
    // Extract user message
    const lastUserMessage = messages
      ?.slice()
      .reverse()
      .find((m: any) => m.role === 'user');
    
    const userText = lastUserMessage?.content || 'Create a UGC ad';
    
    // Forward to UGC agent
    const res = await fetch(new URL('/api/ugc-builder/agent', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: userText,
        userId: user_id,
        conversationHistory: messages?.slice(-10) || [],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return Response.json({ error: errorText }, { status: res.status });
    }

    const agentResponse = await res.json();
    
    // Return in a format the frontend expects
    return Response.json({
      message: agentResponse.message,
      state: agentResponse.state,
      responseType: 'ugc_agent',
    });
    
  } catch (error: any) {
    console.error('[Plan] Error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
