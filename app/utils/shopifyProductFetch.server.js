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
    // 1) Authenticate & determine shop
    const { admin } = await authenticate.admin(request);
    const shopDomain = admin.rest.session.shop;
    const shopName = shopDomain.split('.')[0];

    // 2) Fetch all products via GraphQL
    const products = [];
    const query = `
      query ($cursor: String) {
        products(first: 125, after: $cursor) {
          pageInfo { hasNextPage }
          edges {
            cursor
            node {
              id title vendor productType descriptionHtml handle
              images(first: 1) { edges { node { src } } }
              variants(first: 1) { edges { node { price id } } }
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
        headers: { 'Accept': 'application/json' },
      });
      const json = JSON.parse(await response.text());
      const edges = json.data.products.edges;

      for (const edge of edges) {
        const node = edge.node;
        const variantNode = node.variants.edges[0]?.node || {};
        const imageNode   = node.images.edges[0]?.node   || {};
        const variantUrlParts = variantNode.id.split('/');
        const variantId = variantUrlParts[variantUrlParts.length - 1];

        products.push({
          id:          node.id,
          name:        node.title,
          brand:       node.vendor,
          category:    node.productType,
          description: node.descriptionHtml,
          price:       variantNode.price ? parseFloat(variantNode.price) : null,
          handle:      node.handle || null,
          image:       imageNode.src   || null,
          variantId,
        });

        cursor = edge.cursor;
      }

      hasNextPage = json.data.products.pageInfo.hasNextPage;
    }

    console.log(`Fetched ${products.length} products from Shopify`);

    // 3) Prepare Parquet schema & directory
    const schema = new ParquetSchema({
      id:          { type: 'UTF8', optional: true },
      name:        { type: 'UTF8', optional: true },
      brand:       { type: 'UTF8', optional: true },
      description: { type: 'UTF8', optional: true },
      category:    { type: 'UTF8', optional: true },
      price:       { type: 'DOUBLE', optional: true },
      handle:      { type: 'UTF8', optional: true },
      image:       { type: 'UTF8', optional: true },
      variantId:   { type: 'UTF8', optional: true },
    });

    // 4) Write to a local parquet file under app/utils/shopify_catalogs
    const catalogDir = path.join(__dirname, 'shopify_catalogs');
    if (!fs.existsSync(catalogDir)) {
      fs.mkdirSync(catalogDir, { recursive: true });
    }
    const filePath = path.join(catalogDir, `${shopName}.parquet`);
    const writer = await ParquetWriter.openFile(schema, filePath);

    for (const product of products) {
      await writer.appendRow(product);
    }
    await writer.close();

    console.log(`Product catalog saved to ${filePath}`);

    // 5) Mark task success
    await updateTaskStatus(taskId, 'success');
  } catch (error) {
    console.error("Error downloading products:", error);
    await updateTaskStatus(taskId, 'failed');
  }
}
