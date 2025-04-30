import { generateTTSStream } from "../utils/ttsGenerator.server";

export async function loader() {
  try {
    // Получаем MP3-поток
    const mp3Stream = await generateTTSStream();

    // Возвращаем поток как Response
    return new Response(mp3Stream, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return new Response("Error generating audio", { status: 500 });
  }
}