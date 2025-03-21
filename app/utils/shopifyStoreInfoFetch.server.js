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

    // 2. GraphQL-запрос для тегов с пагинацией
    let allProductTags = [];
    let hasNextPage = true;
    let cursor = null;
    const BATCH_SIZE = 250; // Максимальное кол-во продуктов в одном запросе
    const MAX_BATCHES = 20;  // Ограничение на количество запросов, чтобы избежать слишком долгой выполнения
    let batchCount = 0;

    console.log("Fetching products via GraphQL with pagination...");
    
    while (hasNextPage && batchCount < MAX_BATCHES) {
      batchCount++;
      console.log(`Fetching products batch #${batchCount}${cursor ? ` (after cursor: ${cursor})` : ''}`);
      
      // Формируем запрос с курсором если он есть
      const productQuery = `
        query {
          products(first: ${BATCH_SIZE}${cursor ? `, after: "${cursor}"` : ''}) {
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
      
      let productResponse;
      try {
        productResponse = await admin.graphql(productQuery, {
          headers: { "Accept": "application/json" },
        });
      } catch (graphqlError) {
        const errorText = graphqlError instanceof Response ? await graphqlError.text() : graphqlError.message;
        throw new Error(`GraphQL API failed: ${errorText}`);
      }
      
      console.log(`Batch #${batchCount} - GraphQL response status:`, productResponse.status);
      const responseText = await productResponse.text();
      
      // Логируем только первые 500 символов ответа, чтобы не перегружать логи
      console.log(`Batch #${batchCount} - Raw GraphQL response (truncated):`, 
        responseText.length > 500 ? responseText.substring(0, 500) + "..." : responseText);
      
      const productData = JSON.parse(responseText);

      if (productData.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(productData.errors)}`);
      }
      if (!productData.data || !productData.data.products) {
        throw new Error("No products data in GraphQL response");
      }

      // Собираем теги из текущей порции продуктов
      const batchTags = productData.data.products.edges
        .flatMap(edge => edge.node.tags)
        .filter(tag => tag && tag.trim() !== "");
        
      allProductTags = [...allProductTags, ...batchTags];
      console.log(`Batch #${batchCount} - Fetched ${batchTags.length} tags, total so far: ${allProductTags.length}`);

      // Проверяем есть ли следующая страница
      hasNextPage = productData.data.products.pageInfo.hasNextPage;
      if (hasNextPage) {
        cursor = productData.data.products.pageInfo.endCursor;
      }
      
      // Если это последняя порция, логируем это
      if (!hasNextPage) {
        console.log("Reached the end of products list");
      }
    }

    // Если мы достигли MAX_BATCHES, но hasNextPage всё ещё true
    if (hasNextPage && batchCount >= MAX_BATCHES) {
      console.log(`Reached maximum batch count (${MAX_BATCHES}), some products may not be processed`);
    }

    // 3. Извлекаем только уникальные теги
    const uniqueTags = [...new Set(allProductTags)].sort();
    console.log(`Fetched ${uniqueTags.length} unique tags from ${allProductTags.length} total tags`);

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