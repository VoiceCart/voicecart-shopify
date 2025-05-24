import pkg from 'parquetjs-lite';
import path from 'path';
import fs from 'fs';
import { authenticate } from "../shopify.server";
import { updateTaskStatus } from '../db.server';

const { ParquetSchema, ParquetWriter } = pkg;

export async function startProductFetchTask(taskId, request) {
  try {
    // Authenticate & shop name
    const { admin } = await authenticate.admin(request);
    const shopDomain = admin.rest.session.shop;
    const shopName = shopDomain.split('.')[0];

    // Fetch products via GraphQL...
    const products = [];
    const query = `...`; // your existing GraphQL query
    let hasNextPage = true, cursor = null;

    while (hasNextPage) {
      const resp = await admin.graphql(query, { variables:{cursor}, headers:{Accept:'application/json'} });
      const json = JSON.parse(await resp.text());
      for (const edge of json.data.products.edges) {
        const node = edge.node;
        const variant = node.variants.edges[0]?.node || {};
        const image   = node.images.edges[0]?.node   || {};
        const vidParts = variant.id.split('/');
        products.push({
          id:          node.id,
          name:        node.title,
          brand:       node.vendor,
          category:    node.productType,
          description: node.descriptionHtml,
          price:       variant.price ? parseFloat(variant.price) : null,
          handle:      node.handle || null,
          image:       image.src || null,
          variantId:   vidParts[vidParts.length - 1] || null,
        });
        cursor = edge.cursor;
      }
      hasNextPage = json.data.products.pageInfo.hasNextPage;
    }

    console.log(`Fetched ${products.length} products from Shopify`);

    // Prepare Parquet schema
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

    // Use process.cwd() to get project root → app/utils/shopify_catalogs
    const catalogDir = path.join(process.cwd(), 'app', 'utils', 'shopify_catalogs');
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

    // Mark task success
    await updateTaskStatus(taskId, 'success');
  } catch (error) {
    console.error("Error downloading products:", error);
    await updateTaskStatus(taskId, 'failed');
  }
}
