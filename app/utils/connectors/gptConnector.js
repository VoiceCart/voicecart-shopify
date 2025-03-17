import { PrismaClient } from "@prisma/client";
import { infoLog } from "../logger.server.js";
import { info } from "console";
const prisma = new PrismaClient();



export async function runChatCompletion({
    systemPrompt,
    sessionId,
    userQuery,
    model = "gpt-4o-mini",
    temperature = 0.7,
    numberOfMessagesHistory = 10,
    responseFormat = "text", // e.g., "text" or "json_object"
    stream = false,          // set to true for streaming, false for non-streaming
    signal
}) {
    const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    // infoLog.log("info", `Goes into getThreadHistory ${sessionId}`);
    // 1. Gather conversation history
    const messages = await getThreadHistory({
        numberOfMessagesHistory,
        sessionId,
        userQuery,
        systemPrompt,
    });
    // Logging the messages history to see what's going into chat completion API
    // infoLog.log("info",
    //     "Thread History results:\n" +
    //     messages
    //         .map(({ role, content }, idx) => {
    //             // Safely serialize if "content" is an object
    //             const safeContent =
    //                 typeof content === "object"
    //                     ? JSON.stringify(content)
    //                     : content;
    //             return `${idx}. [${role}]: ${safeContent}`;
    //         })
    //         .join("\n")
    // );

    // 2. Build the request body
    //    If we're not streaming, we should omit `stream` or set it to false.
    const body = {
        model,
        messages,
        temperature,
        stream, // controlled by the parameter
        // If you are using a standard OpenAI endpoint directly,
        // 'response_format' isn't a recognized parameter. 
        // This may be custom logic or an internal/proxy parameter.
        response_format: { type: responseFormat },
    };

    // 3. Send the request
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

    // 4. Handle the response differently based on the `stream` parameter

    if (!stream) {
        const data = await response.json();
        //
        // =============== Non-Streaming Mode ===============
        //
        // The typical shape for ChatCompletion data is:
        // {
        //   id: ...
        //   object: ...
        //   created: ...
        //   choices: [
        //     {
        //       index: 0,
        //       message: {
        //         role: 'assistant',
        //         content: '...'
        //       },
        //       finish_reason: ...
        //     }
        //   ],
        //   usage: ...
        // }
        //
        const finalAnswer = data?.choices?.[0]?.message?.content || "";
        infoLog.log("info", `runChatCompletion Results for session ${sessionId} - ${finalAnswer}`);
        return finalAnswer.trim();
    } else {
        //
        // =============== Streaming Mode ===============
        //
        // Stream the response in chunks using the reader
        //
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
                // Each line should be in the SSE format: "data: ..."
                if (line.startsWith("data: ")) {
                    const jsonStr = line.replace("data: ", "");
                    if (jsonStr === "[DONE]") {
                        break; // stream finished
                    }
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const token = parsed?.choices?.[0]?.delta?.content;
                        if (token) {
                            finalAnswer += token;
                        }
                    } catch (err) {
                        // Skip parse errors
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
