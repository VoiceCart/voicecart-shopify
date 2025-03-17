// app/utils/shopifyProductFetch.server.js

import pkg from 'parquetjs-lite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { authenticate } from "../shopify.server";
import { updateTaskStatus } from '../db.server';
import { shopifyApi } from "@shopify/shopify-api";

const { ParquetSchema, ParquetWriter } = pkg;

export async function startProductFetchTask(taskId, request) {
  try {
    const { admin } = await authenticate.admin(request);
    const shopDomain = admin.rest.session.shop;
    const shopName = shopDomain.split('.')[0];

    const products = [];

    // GraphQL-запрос для получения продуктов
    const query = `
      query ($cursor: String) {
        products(first: 125, after: $cursor) {
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
              title
              vendor
              productType
              descriptionHtml
              onlineStoreUrl
              handle
              images(first: 1) {
                edges {
                  node {
                    src
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    price
                    id
                  }
                }
              }
            }
          }
        }
      }
    `;

    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
      const response = await admin.graphql(query, {
        variables: { cursor },
        headers: { 'Accept': 'application/json' }
      });

      const responseText = await response.text();
      const data = JSON.parse(responseText);

      const edges = data.data.products.edges;
      edges.forEach(edge => {
        const node = edge.node;
        const variant = node.variants.edges[0]?.node || {};
        const image = node.images.edges[0]?.node || {};
        const variantIdUrl = variant.id.split('/');
        const productVariantId = variantIdUrl[variantIdUrl.length-1];
        products.push({
          id: node.id,
          name: node.title,
          brand: node.vendor,
          category: node.productType,
          description: node.descriptionHtml,
          price: variant.price ? parseFloat(variant.price) : null,
          handle: node.handle || null,
          image: image.src || null,
          variantId: productVariantId || null
        });
        cursor = edge.cursor;
      });
      hasNextPage = data.data.products.pageInfo.hasNextPage;
    }
    console.log(`Fetched ${products.length} products from Shopify`);

    const schema = new ParquetSchema({
      id: { type: 'UTF8', optional: true },
      name: { type: 'UTF8', optional: true },
      brand: { type: 'UTF8', optional: true },
      description: { type: 'UTF8', optional: true },
      category: { type: 'UTF8', optional: true },
      price: { type: 'DOUBLE', optional: true },
      handle: { type: 'UTF8', optional: true },
      image: { type: 'UTF8', optional: true },
      variantId: { type: 'UTF8', optional: true }
    });

    const directoryPath = '..\\test\\app\\utils\\shopify_catalogs'
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
    const filePath = path.join(directoryPath, `${shopName}.parquet`);
    const writer = await ParquetWriter.openFile(schema, filePath);

    for (const product of products) {
      await writer.appendRow(product);
    }
    await writer.close();

    console.log(`Product catalog saved to ${filePath}`);

    // Обновляем статус задачи на 'success'
    await updateTaskStatus(taskId, 'success');

  } catch (error) {
    console.error("Error downloading products:", error);

    // Обновляем статус задачи на 'failed'
    await updateTaskStatus(taskId, 'failed');
  }
}


