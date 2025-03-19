// app/utils/shopifyStoreInfoFetch.server.js
import { authenticate } from "../shopify.server";

export async function fetchStoreInfoAndTags(request) {
  console.log("Starting fetchStoreInfoAndTags - version 7"); // Новый маркер

  console.log("Request details:", {
    url: request.url,
    headers: Object.fromEntries(request.headers),
  });

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
    let shopDescription = "No description available"; // Объявляем заранее
    console.log("Fetching shop info via manual REST...");
    const restUrl = `https://${shopDomain}/admin/api/2024-04/shop.json?fields=description,name`;
    console.log("Manual REST URL:", restUrl);
    try {
      const shopResponse = await fetch(restUrl, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": session.accessToken,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      });
      const responseText = await shopResponse.text();
      console.log("Manual REST response status:", shopResponse.status);
      console.log("Manual REST response body:", responseText);
      if (!shopResponse.ok) {
        throw new Error(`Manual REST API failed: ${responseText}`);
      }
      const shopData = JSON.parse(responseText);
      console.log("Parsed shop data:", shopData);
      shopDescription = shopData.shop?.description || "No description available";
    } catch (manualRestError) {
      console.error("Manual REST attempt failed:", manualRestError.message);
      // Не бросаем ошибку, идём дальше с дефолтным значением
    }

    // 2. GraphQL-запрос для тегов
    const productQuery = `
      query {
        products(first: 250) {
          edges {
            node {
              tags
            }
          }
        }
      }
    `;
    console.log("Fetching products via GraphQL...");
    let productResponse;
    try {
      productResponse = await admin.graphql(productQuery, {
        headers: { "Accept": "application/json" },
      });
    } catch (graphqlError) {
      const errorText = graphqlError instanceof Response ? await graphqlError.text() : graphqlError.message;
      throw new Error(`GraphQL API failed: ${errorText}`);
    }
    console.log("GraphQL response status:", productResponse.status);
    const responseText = await productResponse.text();
    console.log("Raw GraphQL response:", responseText);
    const productData = JSON.parse(responseText);

    if (productData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(productData.errors)}`);
    }
    if (!productData.data || !productData.data.products) {
      throw new Error("No products data in GraphQL response");
    }

    // 3. Извлекаем только уникальные теги
    const uniqueTags = [...new Set(
      productData.data.products.edges
        .flatMap(edge => edge.node.tags)
        .filter(tag => tag && tag.trim() !== "")
    )].sort();
    console.log(`Fetched ${uniqueTags.length} unique tags`);

    // Возвращаем только теги, описание пока опционально
    return { uniqueTags, shopDescription };
  } catch (error) {
    console.error("Error in fetchStoreInfoAndTags:", {
      message: error.message || "No message provided",
      stack: error.stack || "No stack provided",
      rawError: error instanceof Response ? { status: error.status, body: await error.text() } : error,
    });
    throw error instanceof Error ? error : new Error(`Unknown error: ${JSON.stringify(error)}`);
  }
}