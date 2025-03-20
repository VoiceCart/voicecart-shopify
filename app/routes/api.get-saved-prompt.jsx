import { json } from "@remix-run/node";
import prisma from "../db.server";

export async function loader({ request }) {
  try {
    const shop = request.headers.get("X-Shopify-Shop-Domain") || "unknown";

    // Fetch the most recent prompt for the shop from the DB
    const savedPrompt = await prisma.prompt.findFirst({
      where: { shop },
      orderBy: { id: "desc" },
    });

    if (!savedPrompt) {
      return json({ error: "No prompt found for this shop" }, { status: 404 });
    }

    return json({
      generalPrompt: savedPrompt.prompt,
    });
  } catch (error) {
    console.error("Error fetching saved prompt:", error);
    return json({ error: error.message || "Failed to fetch saved prompt" }, { status: 500 });
  }
}