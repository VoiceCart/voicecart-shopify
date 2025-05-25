import { Shopify } from "@shopify/shopify-api";

export default async function handler(req, res) {
  const session = await Shopify.Auth.validateSession(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const client = new Shopify.Clients.Graphql(session.shop, session.accessToken);
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
    res.status(200).json({ shop: { myshopifyDomain: shopDomain } });
  } catch (error) {
    console.error("Error fetching shop domain:", error);
    res.status(500).json({ error: "Failed to fetch shop domain" });
  }
}