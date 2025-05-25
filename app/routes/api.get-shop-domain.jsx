import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { json } from "@remix-run/node";

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ["read_themes"],
  hostName: process.env.SHOPIFY_HOST || "localhost",
});

export async function loader({ request }) {
  const session = await shopify.session.getCurrent(request);
  if (!session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = new shopify.clients.Graphql({
    session,
    apiVersion: LATEST_API_VERSION,
  });

  const query = `
    query {
      shop {
        myshopifyDomain
      }
    }
  `;

  try {
    const response = await client.query({ data: query });
    const shopDomain = response.body.data.shop.myshopifyDomain;
    return json({ shop: { myshopifyDomain: shopDomain } });
  } catch (error) {
    console.error("Error fetching shop domain:", error);
    return json({ error: "Failed to fetch shop domain" }, { status: 500 });
  }
}