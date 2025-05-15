import { json } from "@remix-run/node";
import prisma from "../db.server";
import { api } from "../shopify.server";

export async function loader({ request }) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = await api.session.decodeSessionToken(token);
    let shop = payload.shop.trim().toLowerCase();
    if (!shop.endsWith(".myshopify.com")) {
      shop += ".myshopify.com";
    }
    console.log("api.get-saved-prompt: reading prompt for shop =>", shop);

    const savedPrompt = await prisma.prompt.findFirst({
      where: { shop },
      orderBy: { id: "desc" },
    });

    if (!savedPrompt) {
      return json({ error: "No prompt found for this shop" }, { status: 404 });
    }

    return json({ generalPrompt: savedPrompt.prompt });
  } catch (error) {
    console.error("Token validation or fetch error:", error);
    return json({ error: error.message || "Unauthorized or failed to fetch prompt" }, { status: 401 });
  }
}
