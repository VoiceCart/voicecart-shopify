// /app/routes/api.tts.jsx
import { json } from "@remix-run/node";
import { Readable } from "stream";                  // ← add this
import { generateTTSStream } from "../utils/ttsGenerator.server.js";

export const loader = async ({ request }) => {
  const url  = new URL(request.url);
  const text = url.searchParams.get("text") || `Hey there!`;

  try {
    // 1) get a Node.js Readable from your generator
    const mp3NodeStream = await generateTTSStream(text);

    // 2) convert it to a Web ReadableStream  
    const mp3WebStream = Readable.toWeb(mp3NodeStream);

    // 3) return it directly—no extra polyfill wrapping
    return new Response(mp3WebStream, {
      status: 200,
      headers: {
        "Content-Type":               "audio/mpeg",
        "Cache-Control":              "no-store, no-cache, must-revalidate",
        "Pragma":                     "no-cache",
        "Expires":                    "0",
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods":"GET, OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type, Authorization, Cache-Control, Pragma"
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type":               "application/json",
        "Access-Control-Allow-Origin":"*"
      }
    });
  }
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":   "*",
        "Access-Control-Allow-Methods":  "GET, OPTIONS",
        "Access-Control-Allow-Headers":  "Content-Type, Authorization, Cache-Control, Pragma",
        "Access-Control-Max-Age":        "86400"
      }
    });
  }
  return json({ error: "Method not allowed" }, { status: 405 });
};
