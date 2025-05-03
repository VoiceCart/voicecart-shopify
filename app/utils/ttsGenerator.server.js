import { OpenAI } from "openai";
import { Readable } from "stream";

// Инициализация OpenAI клиента
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Генерирует MP3-поток для любого текста
 */
export async function generateTTSStream(text) {
  try {
    const response = await openai.audio.speech.create({
      model:           "tts-1",      // Стандартная модель TTS
      voice:           "alloy",      // Высококачественный голос
      input:           text,         // Текст из запроса
      response_format: "mp3",
    });
    return response.body; // ReadableStream mp3
  } catch (error) {
    console.error("Error generating TTS stream:", error);
    throw error;
  }
}
