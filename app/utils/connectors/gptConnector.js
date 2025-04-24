import { PrismaClient } from "@prisma/client";
import { infoLog } from "../logger.server.js";
import { info } from "console";
const prisma = new PrismaClient();

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
    responseFormat = "text", // e.g., "text" or "json_object"
    stream = false,
    signal,
    shop // optional; if provided, DB prompt will be appended
}) {
    infoLog.log("info", `DEBUG: Shop parameter received: ${shop}`);
    
    // Append saved prompt from DB if shop is provided
    if (shop) {
        systemPrompt = await getShopPrompt(systemPrompt, shop);
        infoLog.log("info", `DEBUG: Combined system prompt for session ${sessionId}:\n${systemPrompt}`);
    } else {
        infoLog.log("info", `DEBUG: No shop provided, using base system prompt only`);
    }

    const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const messages = await getThreadHistory({
        numberOfMessagesHistory,
        sessionId,
        userQuery,
        systemPrompt,
    });
    const body = {
        model,
        messages,
        temperature,
        stream,
        response_format: { type: responseFormat },
    };

    const response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI error: ${response.status} - ${errText}`);
    }

    if (!stream) {
        const data = await response.json();
        const finalAnswer = data?.choices?.[0]?.message?.content || "";
        infoLog.log("info", `runChatCompletion Results for session ${sessionId} - ${finalAnswer}`);
        return finalAnswer.trim();
    } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalAnswer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.trim() !== "");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const jsonStr = line.replace("data: ", "");
                    if (jsonStr === "[DONE]") {
                        break;
                    }
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const token = parsed?.choices?.[0]?.delta?.content;
                        if (token) {
                            finalAnswer += token;
                        }
                    } catch (err) {
                        // skip parse errors
                    }
                }
            }
        }
        return finalAnswer;
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
    // infoLog.log("info", `Session ${sessionId}`);
    // infoLog.log("info", `Preparing chat history for session ${sessionId}`);
    const previousMessages = await prisma.chats.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
        take: numberOfMessagesHistory,
    });
    const conversationHistory = previousMessages.reverse(); // oldest -> newest

    // Build the messages array
    const messages = [];
    messages.push({ role: "system", content: systemPrompt });

    for (const row of conversationHistory) {
        messages.push({ role: "user", content: row.query });
        messages.push({ role: "assistant", content: row.response });
    }
    messages.push({ role: "user", content: userQuery });
    return messages
}
