import { json } from "@remix-run/node";
import { generateTTSStream } from "../utils/ttsGenerator.server.js";

export const loader = async ({ request }) => {
  console.log("\n\n====== TTS API CALLED ======");
  console.log(`TTS API URL: ${request.url}`);
  console.log(`TTS API Method: ${request.method}`);
  console.log(`TTS API Headers:`, Object.fromEntries(request.headers.entries()));
  
  try {
    // Проверяем аутентификацию (опционально, если нужно)
    // Можно закомментировать, если API должен быть публичным
    // const { admin, session } = await authenticate.admin(request);
    
    console.log("Generating TTS stream...");
    const mp3Stream = await generateTTSStream();
    console.log("TTS stream generated successfully!");

    return new Response(mp3Stream, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        // Настраиваем CORS для разрешения запросов из вашего магазина
        "Access-Control-Allow-Origin": "*", // В продакшн лучше указать конкретный домен магазина
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
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

// Добавляем обработчик OPTIONS запроса для CORS preflight
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
};