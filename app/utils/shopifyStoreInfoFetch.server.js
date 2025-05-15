// app/utils/shopifyStoreInfoFetch.server.js
import { authenticate } from "../shopify.server";

export async function fetchStoreInfoAndTags(request) {
  console.log("Starting fetchStoreInfoAndTags - version 10");

  let admin, session;
  try {
    const authResult = await authenticate.admin(request);
    admin = authResult.admin;
    session = authResult.session;
    console.log("Authentication successful");
    console.log("Session details:", {
      shop: session.shop,
      accessToken: session.accessToken ? "present" : "missing",
    });

    if (!session || !session.shop) {
      throw new Error("No valid Shopify session found");
    }

    const shopDomain = session.shop.endsWith(".myshopify.com")
      ? session.shop
      : `${session.shop}.myshopify.com`;
    console.log(`Using shop domain: ${shopDomain}`);

    // 1. REST-запрос для описания магазина
    let shopDescription = "No description available";
    try {
      const response = await admin.rest.get({
        path: "shop",
        query: { fields: "description,name" },
      });
      shopDescription = response?.body?.shop?.description || "No description available";
    } catch (restError) {
      console.error("REST fetch failed:", restError);
    }

    // 2. GraphQL-запросы — используем admin.graphql
    let allProductTags = [];
    let hasNextPage = true;
    let cursor = null;
    const BATCH_SIZE = 250;
    const MAX_BATCHES = 20;
    let batchCount = 0;

    while (hasNextPage && batchCount < MAX_BATCHES) {
      batchCount++;
      const query = `
        query {
          products(first: ${BATCH_SIZE}${cursor ? `, after: "${cursor}"` : ""}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                tags
              }
            }
          }
        }
      `;

      const response = await admin.graphql(query);
      const body = await response.json();

      if (body.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(body.errors)}`);
      }

      const productData = body.data.products;

      const batchTags = productData.edges
        .flatMap(edge => edge.node.tags)
        .filter(tag => tag && tag.trim() !== "");

      allProductTags.push(...batchTags);

      hasNextPage = productData.pageInfo.hasNextPage;
      if (hasNextPage) {
        cursor = productData.pageInfo.endCursor;
      }
    }

    if (hasNextPage) {
      console.warn("Stopped due to max batch limit");
    }

    const uniqueTags = [...new Set(allProductTags)].sort();
    console.log(`Total unique tags: ${uniqueTags.length}`);

    return { uniqueTags, shopDescription };
  } catch (error) {
    console.error("Error in fetchStoreInfoAndTags:", {
      message: error.message || "No message",
      stack: error.stack || "No stack",
    });
    throw error instanceof Error ? error : new Error("Unknown error");
  }
}
