import { json } from "@remix-run/node";
import { fetchStoreInfoAndTags } from "../utils/shopifyStoreInfoFetch.server";
import { runChatCompletion } from "../utils/connectors/gptConnector.js";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    // 1) Use Shopify's session to get the real shop domain
    const { admin } = await authenticate.admin(request);
    let shop = admin.rest.session.shop.trim().toLowerCase();
    if (!shop.endsWith(".myshopify.com")) {
      shop += ".myshopify.com";
    }
    console.log("api.generate-prompt: saving prompt for shop =>", shop);

    // 2) Fetch store info & tags
    const { uniqueTags, shopDescription } = await fetchStoreInfoAndTags(request);
    console.log(`Retrieved ${uniqueTags.length} unique tags for prompt generation`);

    // 3) Build a more detailed prompt for a verbose description
    const openAiPrompt = `Create a comprehensive and detailed description of what this Shopify store sells based on the following data:

TAGS: ${uniqueTags.join(", ")}

STORE DESCRIPTION: ${shopDescription || "No description available"}

Your response should:
1. Provide a thorough overview of the store's product categories and offerings
2. Identify the store's likely target audience or customer base
3. Highlight the main types of products and any specialty items
4. Mention distinctive features or themes that appear across the product range
5. Be written in a professional, informative style
6. Be between 150-200 words in length to capture sufficient detail

Return only the store description as your response, without any additional commentary, preamble, or formatting.`;

    // 4) Call OpenAI with enhanced settings
    const generalPrompt = await runChatCompletion({
      systemPrompt: "You are a retail analytics expert who creates detailed, insightful descriptions of e-commerce stores based on product data.",
      userQuery: openAiPrompt,
      sessionId: "store-info-session",
      model: "gpt-4o-mini", // Keeping the same model
      temperature: 0.7,
      numberOfMessagesHistory: 0,
      responseFormat: "text",
      stream: false,
    });

    // 5) Save in DB
    await prisma.prompt.create({
      data: {
        shop,
        prompt: generalPrompt,
      },
    });
    console.log(`New prompt saved for shop: ${shop} => ${generalPrompt}`);

    // 6) Return store info & tags
    return json({ uniqueTags, shopDescription });
  } catch (error) {
    console.error("Error generating or saving prompt:", error);
    return json({ error: error.message || "Failed to generate or save prompt" }, { status: 500 });
  }
}
