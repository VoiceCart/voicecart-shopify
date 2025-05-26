import { json } from "@remix-run/node";
import { fetchStoreInfoAndTags } from "../utils/shopifyStoreInfoFetch.server";
import { runChatCompletion } from "../utils/connectors/gptConnector.js";
import prisma from "../db.server";
import { authenticate } from "../shopify.server"; // заменили api

export async function loader({ request }) {
  try {
    const { session } = await authenticate.admin(request);
    let shop = session.shop.trim().toLowerCase();
    if (!shop.endsWith(".myshopify.com")) {
      shop += ".myshopify.com";
    }
    console.log("api.generate-prompt: saving prompt for shop =>", shop);

    const { uniqueTags, shopDescription } = await fetchStoreInfoAndTags(request);
    console.log(`Retrieved ${uniqueTags.length} unique tags for prompt generation`);

    const products = await prisma.product.findMany({
      where: { shop },
      select: { title: true },
      take: 100,
    });

    const productTitles = products.map(p => p.title).filter(Boolean);

    const openAiPrompt = `Create a comprehensive and detailed description of what this Shopify store sells based on the following data:

TAGS: ${uniqueTags.length ? uniqueTags.join(", ") : "No tags available"}

STORE DESCRIPTION: ${shopDescription || "No description available"}

PRODUCT TITLES: ${productTitles.length ? productTitles.join(", ") : "No product titles available"}

Your response should:
1. Provide a thorough overview of the store's product categories and offerings
2. Identify the store's likely target audience or customer base
3. Highlight the main types of products and any specialty items
4. Mention distinctive features or themes that appear across the product range
5. Be written in a professional, informative style
6. Be between 150-200 words in length to capture sufficient detail

Return only the store description as your response, without any additional commentary, preamble, or formatting.`;

    const generalPrompt = await runChatCompletion({
      systemPrompt: "You are a retail analytics expert who creates detailed, insightful descriptions of e-commerce stores based on product data.",
      userQuery: openAiPrompt,
      sessionId: "store-info-session",
      model: "gpt-4o-mini",
      numberOfMessagesHistory: 0,
      responseFormat: "text",
      stream: false,
    });

    await prisma.prompt.create({
      data: {
        shop,
        prompt: generalPrompt,
      },
    });
    console.log(`New prompt saved for shop: ${shop} => ${generalPrompt}`);

    return json({ uniqueTags, shopDescription, productTitles });
  } catch (error) {
    console.error("Token validation or prompt generation failed:", error);
    return json({ error: error.message || "Unauthorized or failed to generate prompt" }, { status: 401 });
  }
}
