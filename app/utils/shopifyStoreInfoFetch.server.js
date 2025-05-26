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

    // 2. GraphQL-запросы
    let allProductTags = [];
    let productTitles = [];
    let hasNextPage = true;
    let cursor = null;
    const BATCH_SIZE = 100;
    const MAX_PRODUCTS = 100;

    while (hasNextPage && productTitles.length < MAX_PRODUCTS) {
      const query = `
        query {
          products(first: ${BATCH_SIZE}${cursor ? `, after: "${cursor}"` : ""}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                title
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

      const batchTitles = productData.edges
        .map(edge => edge.node.title)
        .filter(title => !!title);

      allProductTags.push(...batchTags);
      productTitles.push(...batchTitles);

      hasNextPage = productData.pageInfo.hasNextPage;
      cursor = productData.pageInfo.endCursor;
    }

    if (hasNextPage) {
      console.warn("Stopped early after collecting 100 product titles");
    }

    const uniqueTags = [...new Set(allProductTags)].sort();
    console.log(`Total unique tags: ${uniqueTags.length}`);
    console.log(`Total product titles: ${productTitles.length}`);

    return {
      uniqueTags,
      shopDescription,
      productTitles: productTitles.slice(0, 100), // just in case
    };
  } catch (error) {
    console.error("Error in fetchStoreInfoAndTags:", {
      message: error.message || "No message",
      stack: error.stack || "No stack",
    });
    throw error instanceof Error ? error : new Error("Unknown error");
  }
}
