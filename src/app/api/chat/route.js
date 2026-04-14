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


    if (!process.env.RAPIDAPI_KEY) {
      return NextResponse.json({ error: 'RapidAPI Key is missing.' }, { status: 500 });
    }

    let fullTranscript = '';
    try {
      console.log(`Fetching transcript via RapidAPI for: ${url}`);
      const options = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY,
          'x-rapidapi-host': 'youtube-transcript3.p.rapidapi.com'
        }
      };
      
      const res = await fetch(`https://youtube-transcript3.p.rapidapi.com/api/transcript-with-url?url=${encodeURIComponent(url)}&flat=true&lang=en`, options);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        fullTranscript = data.map(item => item.text || item).join(' ');
      } else if (data.transcript && Array.isArray(data.transcript)) {
        fullTranscript = data.transcript.map(item => item.text || item.title || '').join(' ');
      } else if (typeof data === 'string') {
        fullTranscript = data;
      } else {
        fullTranscript = JSON.stringify(data); // Fallback
      }

    } catch (e) {
      console.error("Transcript fetch error via RapidAPI in chat:", e);
      return NextResponse.json({ 
        error: 'Could not fetch transcript via RapidAPI to understand context.' 
      }, { status: 400 });
    }

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
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return NextResponse.json({ reply: response.text });
  } catch (error) {
    console.error("CHAT GENERATION ERROR DETAILS:", error);
    return NextResponse.json({ error: `An error occurred: ${error.message || 'Internal Server Error'}`, details: error.stack }, { status: 500 });
  }
}
