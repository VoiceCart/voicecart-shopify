import { generateTTSStream } from "../../utils/ttsGenerator.server";

export const loader = async () => {
  try {
    const mp3Stream = await generateTTSStream();

    return new Response(mp3Stream, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return new Response("Error generating audio", { status: 500 });
  }
};
