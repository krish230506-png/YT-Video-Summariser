import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenAI } from '@google/genai';

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

    let transcriptItems = [];
    try {
      // Extract video ID if it's a full URL
      const videoIdMatch = url.match(/(?:v=|\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const targetId = videoIdMatch ? videoIdMatch[1] : url;
      
      console.log(`Fetching transcript for video ID: ${targetId}`);
      transcriptItems = await YoutubeTranscript.fetchTranscript(targetId);
    } catch (e) {
      console.error("Transcript fetch error:", e);
      return NextResponse.json({ 
        error: 'Could not fetch transcript for this video. It might not have closed captions enabled, or YouTube is blocking our request. Try another video.' 
      }, { status: 400 });
    }

    const fullTranscript = transcriptItems.map(item => item.text).join(' ');
    
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
      model: 'gemini-1.5-flash',
      contents: prompt,
    });
    
    return NextResponse.json({ summary: response.text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An internal error occurred while generating the summary.' }, { status: 500 });
  }
}
