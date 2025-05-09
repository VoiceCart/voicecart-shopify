import { json } from "@remix-run/node";
import { generateTTSStream } from "../utils/ttsGenerator.server.js";

export const loader = async ({ request }) => {
  // Смотрим ?text=… из URL
  const url  = new URL(request.url);
  const text = url.searchParams.get("text") || 
    `Hey there!`;

  try {
    const mp3Stream = await generateTTSStream(text);
    return new Response(mp3Stream, {
      status: 200,
      headers: {
        "Content-Type":               "audio/ogg; codecs=opus",
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
    // CORS preflight
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
