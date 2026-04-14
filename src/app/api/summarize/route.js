import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenAI } from '@google/genai';

// Diagnostic check to let you see if the new key is loaded without costing any usage
const key = process.env.GEMINI_API_KEY;
if (key) {
  console.log(`✅ Server loaded API Key successfully! Starts with: ${key.substring(0, 10)}... Length: ${key.length}`);
} else {
  console.error(`❌ NO API KEY DETECTED IN ENVIRONMENT`);
}

export async function POST(req) {
  try {
    const { url, language = "English" } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API Key is not configured on the server. Please add it to your .env.local file.' }, { status: 500 });
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


    if (!process.env.RAPIDAPI_KEY) {
      return NextResponse.json({ error: 'RapidAPI Key is missing. Please add RAPIDAPI_KEY to your .env.local file.' }, { status: 500 });
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
      console.error("Transcript fetch error via RapidAPI:", e);
      return NextResponse.json({ 
        error: 'Could not fetch transcript via RapidAPI. Check your RapidAPI key or usage limits.' 
      }, { status: 400 });
    }

    if (fullTranscript.length < 50) {
      return NextResponse.json({ error: 'Transcript is too short or empty.' }, { status: 400 });
    }

    const prompt = `You are an expert AI assistant that analyzes YouTube video transcripts and produces structured summaries.

CRITICAL INSTRUCTION: Ensure the ENTIRE generated response is safely translated and presented fluently in: ${language}. 

Your task is to read the transcript of a YouTube video and generate a magnificent, highly structured summary.

Follow these strict instructions and headers:

## Overview
Provide a short 3-5 sentence explanation of the main idea of the video.

## Mindmap Visual Summary
Provide a high-level visual mindmap of the video's core concepts. Use ASCII tree characters (├, └, etc.) inside a markdown code block to show the hierarchy of ideas clearly. Example format:
\`\`\`
AI Concepts
 ├ Neural Networks
 │ ├ Layers
 │ └ Activation
 └ Training Process
\`\`\`

## Smart Chapters
Divide the video logically into chapters based on topic transitions. 
CRITICAL FORMAT RULE: You MUST format each line exactly like this: [MM:SS] - Chapter Title
Use the implicit flow of ideas to approximate logical timestamps if exact ones aren't available, but always provide them.

## Key Points
Extract the most important concepts discussed. Use concise bullet points.

## Actionable Insights (if applicable)
Practical takeaways, tips, or real-world lessons from the video.

## TL;DR Summary
A maximum of 2 sentences boiling down the ultimate message.

Transcript:
${fullTranscript.substring(0, 50000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return NextResponse.json({ summary: response.text });
  } catch (error) {
    console.error("GENERATION ERROR DETAILS:", error);
    return NextResponse.json({ 
      error: `An error occurred: ${error.message || 'Internal Server Error'}`,
      details: error.stack 
    }, { status: 500 });
  }
}
