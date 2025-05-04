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
      model:           "gpt-4o-mini-tts",
      voice:           "sage",
      input:           text,
      instructions:    'Accent/Affect: Warm, refined, and gently instructive, reminiscent of a friendly art instructor.\n\nTone: Calm, encouraging, and articulate, clearly describing each step with patience.\n\nPacing: Slow and deliberate, pausing often to allow the listener to follow instructions comfortably.\n\nEmotion: Cheerful, supportive, and pleasantly enthusiastic; convey genuine enjoyment and appreciation of art.\n\nPronunciation: Clearly articulate artistic terminology (e.g., \"brushstrokes,\" \"landscape,\" \"palette\") with gentle emphasis.\n\nPersonality Affect: Friendly and approachable with a hint of sophistication; speak confidently and reassuringly, guiding users through each painting step patiently and warmly.',
      response_format: "mp3",
    });
    return response.body; // ReadableStream mp3
  } catch (error) {
    console.error("Error generating TTS stream:", error);
    throw error;
  }
}
