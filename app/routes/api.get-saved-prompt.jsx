import { json } from "@remix-run/node";
import prisma from "../db.server";
import shopify from "../shopify.server";

export async function loader({ request }) {
  try {
    const { session } = await shopify.authenticate.admin(request);
    let shop = session.shop.trim().toLowerCase();
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
