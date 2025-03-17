import { json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import { errorLog, infoLog } from "../utils/logger.server.js";
import { checkForExistingThread } from "../utils/connectors/gptConnector.js";
import { getChatResponse } from "../utils/connectors/gptHandlers.js";

const prisma = new PrismaClient();

/**
 *  1) LOADER  => handles GET requests  (reads data)
 *  2) ACTION => handles DELETE requests (removes data)
 */

// ==================== 1) loader (GET) ====================
export const inFlightRequests = new Map();
export async function loader({ request }) {
    const method = request.method.toUpperCase();
    if (method !== "GET") {
        throw new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const url = new URL(request.url);
        const searchParams = url.searchParams;
        const sessionId = searchParams.get("session");
        const userQuery = searchParams.get("query");
        const action = searchParams.get("action");
        const lang = searchParams.get("lang");
        const shopDomain = request.headers.get("X-Shop-Name");
        const shop = shopDomain.split('.')[0];

        if (!sessionId) {
            return json({ error: "Shopify session is required." }, { status: 400 });
        }

        if (action === "getAssistantResponse") {
            if (!shop) {
                return json({ error: "Shop is required." }, { status: 400 });
            }

            infoLog.log("info", `Assistant GET: session = ${sessionId}, query = ${userQuery}, shop = ${shop}`);

            const threadId = await checkForExistingThread({ sessionId, shop });

            const controller = new AbortController();
            inFlightRequests.set(sessionId, { controller });

            let producedMessages;
            try {
                producedMessages = await getChatResponse({
                    userQuery,
                    shop,
                    sessionId,
                    signal: controller.signal,
                    lang
                });
            } catch (error) {
                if (error.name === "AbortError") {
                    errorLog.log("error", "OpenAI call was aborted on the server side.");
                    return json({ messages: [] });
                }
                errorLog.log("error", `Error generating response: ${error}`);
                return json({ error: "Failed to generate response." }, { status: 500 });
            } finally {
                inFlightRequests.delete(sessionId);
            }

            console.log("DEBUG HISTORY: ", producedMessages)
            const responseMessage = JSON.stringify(producedMessages);
            // Filter and transform "products" messages
            producedMessages = producedMessages.map((message) => {
                if (message.type === "products") {
                    return {
                        type: message.type,
                        value: message.value.map((product) => ({
                            handle: product.handle,
                            variantId: product.variantId,
                        })),
                    };
                }
                return message;
            });

            console.log("Saving message to Prisma:\n", responseMessage);
            await prisma.chats.create({
                data: {
                    shop,
                    sessionId,
                    threadId,
                    query: userQuery,
                    response: responseMessage,
                    createdAt: new Date(),
                },
            });

            console.log("Final response:", JSON.stringify(producedMessages, null, 2));
            return json({ messages: producedMessages });
        } else if (action == "getSessionHistory") {
            if (!shop) {
                return json({ error: "Shop is required." }, { status: 400 });
            }
            console.log("DEBUG: ", "sessionId: ", sessionId, "shop: ", shop)
            const chats = await prisma.chats.findMany({
                where: { sessionId, shop },
                orderBy: { createdAt: "asc" },
            });
            console.log("DEBUG: ", chats)
            const messages = [];

            chats.forEach(chat => {
                if (chat.query) {
                    messages.push({
                        type: "message",
                        value: chat.query,
                        sender: "customer",
                        createdAt: chat.createdAt,
                    });
                }
                if (chat.response) {
                    console.log("DEBUG before chat response: ", chat.response);
                    const botResponseList = JSON.parse(chat.response);
                    for (let messageStructure of botResponseList) {
                        messages.push({
                            type: messageStructure.type,
                            value: messageStructure.value,
                            sender: "bot",
                            createdAt: chat.createdAt,
                        });
                    }
                }
            });

            messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            return json(messages);
        } else if (action == "getLanguage") {
            console.log('DEBUG: Getting language for', shop)
            if (!shop) {
                return json({ error: "Shop is required." }, { status: 400 });
            }
            const languageEntry = await prisma.languages.findUnique({
                where: { shop },
            });
            if (!languageEntry) {
                return json({ error: "Language not set for this shop." }, { status: 404 });
            }
            return json({ language: languageEntry.language }, { status: 200 });
        }
    } catch (error) {
        errorLog.log("error", "Unexpected error (GET flow):", { error });
        return json({ error: "Unexpected error occurred." }, { status: 500 });
    }
}
// ==================== 2) action (DELETE) ====================
export async function action({ request }) {
    const method = request.method.toUpperCase();
    if (method !== "DELETE") {
        // This route only handles DELETE requests
        throw new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("session");
        const userQuery = url.searchParams.get("query");

        // Logging or debugging
        infoLog.log("info", `DELETE request for session = "${sessionId}", query = "${userQuery}"`);

        if (!sessionId) {
            return json({ error: "Session is required." }, { status: 400 });
        }
        // If you want to require userQuery specifically:
        // if (!userQuery) {
        //   return json({ error: "Query is required." }, { status: 400 });
        // }

        // 1) Check if there's an active in-flight request for this session
        const inflight = inFlightRequests.get(sessionId);
        if (inflight) {
            // => The user’s GPT call is still running
            // => So we ABORT it with the stored controller
            inflight.controller.abort();

            // Remove from the map so we don't try again
            inFlightRequests.delete(sessionId);

            // Return a response to the client
            return json({
                aborted: true,
                message: "The OpenAI request was still running and has been aborted. No DB entry saved.",
            });
        }

        // 2) If no in-flight request, it means the GPT call already finished
        // => So we proceed to delete the last message from the DB
        const lastChat = await prisma.chats.findFirst({
            where: { sessionId, query: userQuery }, // or just { sessionId } if you want to remove the last message regardless of query
            orderBy: { createdAt: "desc" },
        });

        if (!lastChat) {
            // Nothing to delete
            return json({
                deleted: false,
                message: `No chat found for session="${sessionId}"${userQuery ? ` and query="${userQuery}"` : ""}`,
            });
        }

        // 3) Actually delete the row
        await prisma.chats.delete({
            where: { id: lastChat.id },
        });

        return json({
            deleted: true,
            message: "Deleted the last message from the DB for that session/query.",
        });
    } catch (err) {
        errorLog.log("error", "Error in DELETE flow:", { err });
        return json({ error: "Failed to delete last message." }, { status: 500 });
    }
}