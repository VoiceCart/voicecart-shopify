import { json } from "@remix-run/node";
import { fetchStoreInfoAndTags } from "../utils/shopifyStoreInfoFetch.server";
import { runChatCompletion } from "../utils/connectors/gptConnector.js";
import prisma from "../db.server";

export async function loader({ request }) {
  try {
    // Fetch store info and tags
    const { uniqueTags, shopDescription } = await fetchStoreInfoAndTags(request);

    // Construct the OpenAI prompt
    const openAiPrompt = `Create a concise general prompt that describes what a Shopify store sells based on the following information. The prompt should thoroughly represent the store's assortment without being verbose, focusing on the overall theme or key product categories rather than listing every detail. Use the provided list of tags and, if available, the SEO description to inform your response. Here’s the data:  
- Tags: ${uniqueTags.join(", ")}  
- SEO Description: ${shopDescription || ""}  
Return only the new general prompt as your response, nothing else.`;

    // Call OpenAI API
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

    // Get shop from headers
    const shop = request.headers.get("X-Shopify-Shop-Domain") || "unknown";

    // Save the generated prompt in DB
    await prisma.prompt.create({
      data: {
        shop,
        prompt: generalPrompt,
      },
    });

    // Return only store info and tags, not the prompt
    return json({
      uniqueTags,
      shopDescription,
    });
  } catch (error) {
    console.error("Error generating or saving prompt:", error);
    return json({ error: error.message || "Failed to generate or save prompt" }, { status: 500 });
  }
}