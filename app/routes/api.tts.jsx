import { generateTTSStream } from "../utils/ttsGenerator.server.js";

export const loader = async ({ request }) => {
  try {
    console.log(`TTS API called from: ${request.url}`);
    const mp3Stream = await generateTTSStream();

    return new Response(mp3Stream, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        // Add CORS headers to ensure it works in embedded contexts
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
};