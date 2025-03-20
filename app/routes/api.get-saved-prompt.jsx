import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    // 1) Use Shopify’s session to get the real shop domain
    const { admin } = await authenticate.admin(request);
    let shop = admin.rest.session.shop.trim().toLowerCase();
    if (!shop.endsWith(".myshopify.com")) {
      shop += ".myshopify.com";
    }
    console.log("api.get-saved-prompt: reading prompt for shop =>", shop);

    // 2) Fetch the most recent prompt
    const savedPrompt = await prisma.prompt.findFirst({
      where: { shop },
      orderBy: { id: "desc" },
    });

    if (!savedPrompt) {
      return json({ error: "No prompt found for this shop" }, { status: 404 });
    }

    // 3) Return it
    return json({ generalPrompt: savedPrompt.prompt });
  } catch (error) {
    console.error("Error fetching saved prompt:", error);
    return json({ error: error.message || "Failed to fetch saved prompt" }, { status: 500 });
  }
}
