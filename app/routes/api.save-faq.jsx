import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { session } = await authenticate.admin(request);
    let shop = session.shop.trim().toLowerCase();
    if (!shop.endsWith(".myshopify.com")) {
      shop += ".myshopify.com";
    }

    const { faq } = await request.json();

    if (!faq || !faq.trim()) {
      return json({ error: "FAQ content is required" }, { status: 400 });
    }

    // Check if FAQ already exists for this shop
    const existingFaq = await prisma.faq.findFirst({
      where: { shop },
    });

    if (existingFaq) {
      // Update existing FAQ
      await prisma.faq.update({
        where: { id: existingFaq.id },
        data: { 
          faq: faq.trim(),
          updatedAt: new Date(),
        },
      });
      console.log(`FAQ updated for shop: ${shop}`);
    } else {
      // Create new FAQ
      await prisma.faq.create({
        data: {
          shop,
          faq: faq.trim(),
        },
      });
      console.log(`FAQ created for shop: ${shop}`);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error saving FAQ:", error);
    return json({ error: error.message || "Failed to save FAQ" }, { status: 500 });
  }
}
