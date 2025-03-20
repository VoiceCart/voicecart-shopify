import { PrismaClient } from "@prisma/client";
import { infoLog } from "../logger.server.js";

const prisma = new PrismaClient();

/**
 * Builds the combined system prompt by fetching the shop context from DB,
 * then appending the base system prompt.
 * @param {string} baseSystemPrompt - The base prompt to combine with shop context
 * @param {string} shop - The shop domain (e.g., "getvoicecart.myshopify.com")
 */
export async function getCombinedPrompt(baseSystemPrompt, shop) {
    // Ensure the shop name is the full domain
    if (!shop.includes('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }
  
    // 1. Fetch the saved prompt from DB using the shop name
    const savedPrompt = await prisma.prompt.findFirst({
      where: { shop },
      orderBy: { id: "desc" },
    });
    console.log(`Saved prompt for shop ${shop}:`, savedPrompt); // Debug log
  
    // 2. Use the saved prompt or fallback
    const shopContext = savedPrompt?.prompt || "Default store context (none found).";
  
    // 3. Combine them
    const fullSystemPrompt = `Shop Context: ${shopContext}\n\n${baseSystemPrompt}`;
  
    return fullSystemPrompt;
}

/**
 * Sends a chat completion request to OpenAI, using the already-combined system prompt.
 */
export async function runChatCompletion({
  systemPrompt,             // the already combined prompt
  sessionId,
  userQuery,
  model = "gpt-4o-mini",
  temperature = 0.7,
  numberOfMessagesHistory = 10,
  responseFormat = "text",  // e.g., "text" or "json_object"
  stream = false,
  signal
}) {
  const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  // 1. Build the conversation history
  const messages = await getThreadHistory({
    numberOfMessagesHistory,
    sessionId,
    userQuery,
    systemPrompt,
  });

  // 2. Build request body
  const body = {
    model,
    messages,
    temperature,
    stream,
    response_format: { type: responseFormat },
  };

  // Log the final system prompt so you can see it in the server console
  infoLog.log("info", `\n[DEBUG] Final prompt for session ${sessionId}:\n${systemPrompt}`);

  // 3. Send the request to OpenAI
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${errText}`);
  }

  if (!stream) {
    const data = await response.json();
    const finalAnswer = data?.choices?.[0]?.message?.content || "";
    infoLog.log("info", `runChatCompletion result for session ${sessionId}:\n${finalAnswer}`);
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

/**
 * Retrieves the conversation history from the DB (latest n messages).
 */
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

/**
 * Checks or creates a thread for the session.
 */
export async function checkForExistingThread({ sessionId, shop }) {
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
    infoLog.log("info", `Created new thread for session ${sessionId} with shop ${shop}`);
  }
  return threadId;
}