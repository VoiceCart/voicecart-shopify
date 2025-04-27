import { json } from "@remix-run/node";
import OpenAI from "openai";
import { generateSpeech } from "../utils/connectors/gptConnector";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function action({ request }) {
  try {
    // Parse the request body
    const body = await request.json();
    const { text, instructions } = body;

    if (!text) {
      return json({ error: "Text is required" }, { status: 400 });
    }

    // Call the generateSpeech function from gptConnector.js
    const response = await generateSpeech({ text, instructions, signal: request.signal });

    // The response from openai.audio.speech.create is a ReadableStream or Buffer
    // We need to convert it to a format that can be sent back to the client
    // For simplicity, we'll read the stream into a buffer
    const chunks = [];
    for await (const chunk of response) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Return the audio data as a response with appropriate headers
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mp3",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("TTS endpoint error:", error);
    return json({ error: "Failed to generate speech" }, { status: 500 });
  }
}

// Handle GET requests (if needed, though your app uses POST)
export async function loader() {
  return json({ error: "Method not allowed" }, { status: 405 });
}