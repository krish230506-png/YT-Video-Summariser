import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenAI } from '@google/genai';

export async function POST(req) {
  try {
    const { url, messages } = await req.json();
    
    if (!url || !messages || messages.length === 0) {
      return NextResponse.json({ error: 'URL and messages are required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API Key is not configured on the server.' }, { status: 500 });
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


    let transcriptItems = [];
    try {
      // Extract video ID if it's a full URL
      const videoIdMatch = url.match(/(?:v=|\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const targetId = videoIdMatch ? videoIdMatch[1] : url;
      
      console.log(`Fetching transcript in chat for video ID: ${targetId}`);
      transcriptItems = await YoutubeTranscript.fetchTranscript(targetId);
    } catch (e) {
      console.error("Transcript fetch error (chat):", e);
      return NextResponse.json({ 
        error: 'Could not fetch transcript for this video to understand context. It might not have closed captions enabled.' 
      }, { status: 400 });
    }

    const fullTranscript = transcriptItems.map(item => item.text).join(' ');
    
    // Construct the context block
    let conversationStr = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

    const prompt = `You are a helpful, expert AI tutor. You are specifically helping the user understand a Youtube video.
    
Use the following transcript from the video to answer the user's questions accurately. If the answer is not in the transcript, let the user know, but use your general knowledge to assist them as a tutor if appropriate.

TRANSCRIPT:
${fullTranscript.substring(0, 50000)}

---
CONVERSATION HISTORY:
${conversationStr}

SYSTEM: Please answer the user's last message above appropriately as the MODEL. Provide helpful markdown formatting if needed. Do not include the "MODEL:" prefix in your response.`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });
    
    return NextResponse.json({ reply: response.text });
  } catch (error) {
    console.error("CHAT GENERATION ERROR DETAILS:", error);
    return NextResponse.json({ error: `An error occurred: ${error.message || 'Internal Server Error'}`, details: error.stack }, { status: 500 });
  }
}
