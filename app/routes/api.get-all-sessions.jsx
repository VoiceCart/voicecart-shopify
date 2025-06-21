import { json } from "@remix-run/node";
import prisma from "../db.server";
import shopify from "../shopify.server";

export async function loader({ request }) {
  try {
    const { session } = await shopify.authenticate.admin(request);
    let shop = session.shop.trim().toLowerCase();
    if (shop.endsWith(".myshopify.com")) {
      shop = shop.replace(".myshopify.com", "");
    }

    // DEBUG: All shops in chats
    const allShops = await prisma.chats.findMany({
      select: { shop: true },
      distinct: ['shop'],
    });
    console.log('DEBUG: All shops in chats:', allShops);
    console.log("api.get-all-sessions: reading sessions for shop =>", shop);

    // Получаем все уникальные сессии для магазина
    const sessions = await prisma.chats.groupBy({
      by: ['sessionId'],
      where: { shop },
      _count: {
        id: true
      },
      _max: {
        createdAt: true
      },
      _min: {
        createdAt: true
      },
      orderBy: {
        _max: {
          createdAt: 'desc'
        }
      }
    });

    // Для каждой сессии получаем детали чатов
    const sessionsWithDetails = await Promise.all(
      sessions.map(async (sessionInfo) => {
        const chats = await prisma.chats.findMany({
          where: { 
            shop,
            sessionId: sessionInfo.sessionId 
          },
          orderBy: { createdAt: "asc" },
        });

        // Форматируем сообщения для отображения
        const messages = [];
        chats.forEach(chat => {
          if (chat.query) {
            messages.push({
              type: "user",
              text: chat.query,
              time: chat.createdAt.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })
            });
          }
          if (chat.response) {
            try {
              const botResponseList = JSON.parse(chat.response);
              for (let messageStructure of botResponseList) {
                if (messageStructure.type === "message") {
                  messages.push({
                    type: "bot",
                    text: messageStructure.value,
                    time: chat.createdAt.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })
                  });
                }
              }
            } catch (error) {
              console.error("Error parsing bot response:", error);
            }
          }
        });

        return {
          id: sessionInfo.sessionId,
          sessionId: sessionInfo.sessionId,
          date: sessionInfo._max.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }),
          time: sessionInfo._max.createdAt.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          messageCount: sessionInfo._count.id,
          messages: messages,
          createdAt: sessionInfo._max.createdAt
        };
      })
    );

    return json({ sessions: sessionsWithDetails });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return json({ error: error.message || "Failed to fetch sessions" }, { status: 500 });
  }
} 