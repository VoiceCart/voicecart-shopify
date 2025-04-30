import { AsyncOpenAI } from "openai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { Readable } from "stream";

// Устанавливаем путь к ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Инициализация OpenAI клиента
const openai = new AsyncOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Захардкоженное сообщение
const input = `Hi! My name is Eva and I'm here to assist you with shopping, managing your cart, applying discounts, and checking out 😊\n\nWe offer a wide range of health, beauty, and wellness products, including skincare, supplements, and personal care items like acne treatments and anti-aging solutions. We also have specialty items for energy, stress relief, and cognitive enhancement. Would you like to explore some products?\n\nHere are some of the best skin hydration I can recommend`;

const instructions = `Accent/Affect: Warm, refined, and gently instructive, reminiscent of a friendly art instructor.\n\nTone: Calm, encouraging, and articulate, clearly describing each step with patience.\n\nPacing: Slow and deliberate, pausing often to allow the listener to follow instructions comfortably.\n\nEmotion: Cheerful, supportive, and pleasantly enthusiastic; convey genuine enjoyment and appreciation of art.\n\nPronunciation: Clearly articulate artistic terminology (e.g., "brushstrokes," "landscape," "palette") with gentle emphasis.\n\nPersonality Affect: Friendly and approachable with a hint of sophistication; speak confidently and reassuringly, guiding users through each painting step patiently and warmly.`;

// Функция для генерации аудио и возврата MP3-потока
export async function generateTTSStream() {
  try {
    // Генерация аудио с OpenAI TTS
    const response = await openai.audio.speech.with_streaming_response.create({
      model: "gpt-4o-mini-tts",
      voice: "sage",
      input,
      instructions,
      response_format: "pcm",
    });

    // Собираем PCM-данные в Buffer
    const pcmBuffer = Buffer.concat(await response.body.toArray());

    // Создаем Readable поток из PCM
    const pcmStream = new Readable();
    pcmStream.push(pcmBuffer);
    pcmStream.push(null); // Завершаем поток

    // Создаем MP3-поток с помощью ffmpeg
    const mp3Stream = ffmpeg()
      .input(pcmStream)
      .inputOptions(["-f s16le", "-ar 24000", "-ac 1"]) // PCM: 16-bit, 24kHz, mono
      .audioCodec("libmp3lame")
      .format("mp3")
      .pipe();

    return mp3Stream;
  } catch (error) {
    console.error("Error generating TTS stream:", error);
    throw error;
  }
}