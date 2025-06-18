import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { session } = await authenticate.admin(request);
    let shop = session.shop.trim().toLowerCase();
    if (!shop.endsWith(".myshopify.com")) {
      shop += ".myshopify.com";
    }

    console.log("api.get-faq: reading FAQ for shop =>", shop);

    const savedFaq = await prisma.faq.findFirst({
      where: { shop },
      orderBy: { updatedAt: "desc" },
    });

    if (!savedFaq) {
      return json({ faq: null });
    }

    return json({ faq: savedFaq.faq });
  } catch (error) {
    console.error("Error fetching FAQ:", error);
    return json({ error: error.message || "Failed to fetch FAQ" }, { status: 500 });
  }
}
