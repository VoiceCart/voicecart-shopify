import { PrismaClient } from "@prisma/client";
import { infoLog } from "../logger.server.js";
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getShopPrompt(baseSystemPrompt, shop) {
    if (!shop.includes('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }
    const savedPrompt = await prisma.prompt.findFirst({
      where: { shop },
      orderBy: { id: "desc" },
    });
    infoLog.log("info", `Saved prompt for shop ${shop}: ${JSON.stringify(savedPrompt)}`);
    const shopContext = savedPrompt?.prompt || "Default store context (none found).";
    const fullSystemPrompt = `Shop Context: ${shopContext}\n\n${baseSystemPrompt}`;
    return fullSystemPrompt;
}

export async function runChatCompletion({
    systemPrompt,
    sessionId,
    userQuery,
    model = "gpt-4o-mini",
    temperature = 0,
    numberOfMessagesHistory = 10,
    responseFormat = "text",
    stream = false,
    signal,
    shop
}) {
    infoLog.log("info", `DEBUG: Shop parameter received: ${shop}`);
    
    if (shop) {
        systemPrompt = await getShopPrompt(systemPrompt, shop);
        infoLog.log("info", `DEBUG: Combined system prompt for session ${sessionId}:\n${systemPrompt}`);
    } else {
        infoLog.log("info", `DEBUG: No shop provided, using base system prompt only`);
    }

    const messages = await getThreadHistory({
        numberOfMessagesHistory,
        sessionId,
        userQuery,
        systemPrompt,
    });

    const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        stream,
        response_format: { type: responseFormat },
    }, { signal });

    if (!stream) {
        const finalAnswer = response.choices?.[0]?.message?.content || "";
        infoLog.log("info", `runChatCompletion Results for session ${sessionId} - ${finalAnswer}`);
        return finalAnswer.trim();
    } else {
        let finalAnswer = "";
        for await (const chunk of response) {
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) {
                finalAnswer += token;
            }
        }
        return finalAnswer;
    }
}

export async function generateSpeech({ text, instructions, signal }) {
    try {
        const response = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy',
            input: text,
            instructions,
        }, { signal });
        return response;
    } catch (error) {
        console.error('OpenAI TTS error:', error);
        throw error;
    }
}

export async function checkForExistingThread({
    sessionId, shop
}) {
    let threadId;
    const existingThread = await prisma.threads.findFirst({
        where: { shop, sessionId },
    });

    if (existingThread) {
        threadId = existingThread.threadId;
        infoLog.log("info", "Assistant - Found existing threadId");
    } else {
        const randomInt = Math.floor(Math.random() * 1000000);
        threadId = `thread_${Date.now()}_${randomInt}`;
        await prisma.threads.create({
            data: {
                shop,
                sessionId,
                threadId,
                createdAt: new Date(),
            },
        });
    }
    return threadId;
}

export async function getThreadHistory({ numberOfMessagesHistory, sessionId, userQuery, systemPrompt }) {
    const previousMessages = await prisma.chats.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
        take: numberOfMessagesHistory,
    });
    const conversationHistory = previousMessages.reverse();

    const messages = [];
    messages.push({ role: "system", content: systemPrompt });

    for (const row of conversationHistory) {
        messages.push({ role: "user", content: row.query });
        messages.push({ role: "assistant", content: row.response });
    }
    messages.push({ role: "user", content: userQuery });
    return messages;
}