import { generateTTSStream } from "../utils/ttsGenerator.server.js";

export const loader = async ({ request }) => {
  console.log("\n\n====== TTS API CALLED ======");
  console.log(`TTS API URL: ${request.url}`);
  console.log(`TTS API Method: ${request.method}`);
  console.log(`TTS API Headers:`, Object.fromEntries(request.headers.entries()));
  
  try {
    console.log("Generating TTS stream...");
    const mp3Stream = await generateTTSStream();
    console.log("TTS stream generated successfully!");

    return new Response(mp3Stream, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
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