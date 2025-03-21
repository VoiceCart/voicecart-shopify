import { json } from "@remix-run/node";
import { fetchStoreInfoAndTags } from "../utils/shopifyStoreInfoFetch.server";
import { runChatCompletion } from "../utils/connectors/gptConnector.js";
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
    console.log("api.generate-prompt: saving prompt for shop =>", shop);

    // 2) Fetch store info & tags
    const { uniqueTags, shopDescription } = await fetchStoreInfoAndTags(request);

    // 3) Build the prompt
    const openAiPrompt = `Create a concise general prompt describing what the Shopify store sells. 
- Tags: ${uniqueTags.join(", ")}  
- SEO Description: ${shopDescription || ""}  
Return only the new general prompt as your response, nothing else.`;

    // 4) Call OpenAI
    const generalPrompt = await runChatCompletion({
      systemPrompt: "You are a helpful assistant that generates concise prompts.",
      userQuery: openAiPrompt,
      sessionId: "store-info-session",
      model: "gpt-4o-mini",
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
