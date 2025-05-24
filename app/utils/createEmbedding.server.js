import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { authenticate } from "../shopify.server";
import { updateTaskStatus } from '../db.server';
import pkg from 'parquetjs-lite';
const { ParquetReader, ParquetWriter, ParquetSchema } = pkg;
import { Writable } from 'stream';

export async function createEmbeddingsTask(taskId, request) {
  let embeddingResponse;
  try {
    // Authenticate and get the shop name
    const { admin } = await authenticate.admin(request);
    const shopDomain = admin.rest.session.shop;
    const shopName = shopDomain.split('.')[0];
    console.log("Creating embeddings for:", shopName);

    // Path to existing Parquet
    const directoryPath = '..\\test\\app\\utils\\shopify_catalogs';
    const filePath = path.join(directoryPath, `${shopName}.parquet`);
    if (!fs.existsSync(filePath)) {
      throw new Error('Product catalog not found. Please generate the catalog first.');
    }

    // Read Parquet into array
    const reader = await ParquetReader.openFile(filePath);
    const products = [];
    try {
      const cursor = reader.getCursor();
      let product;
      while ((product = await cursor.next())) {
        products.push({
          variantId: product.variantId,
          name: product.name,
          description: product.description,
          category: product.category,
          brand: product.brand,
          price: product.price,
          handle: product.handle,
          image: product.image,
        });
      }
    } finally {
      await reader.close();
    }

    console.log(`Preparing to create embeddings for ${products.length} products`);

    // Serialize to Parquet in memory
    const schema = new ParquetSchema({
      variantId: { type: 'UTF8' },
      name:      { type: 'UTF8' },
      description:{ type: 'UTF8' },
      category:  { type: 'UTF8' },
      brand:     { type: 'UTF8' },
      price:     { type: 'DOUBLE' },
      handle:    { type: 'UTF8' },
    });

    const parquetBuffer = await new Promise(async (resolve, reject) => {
      const chunks = [];
      const writable = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });
      try {
        const writer = await ParquetWriter.openStream(schema, writable);
        for (const record of products) {
          await writer.appendRow(record);
        }
        await writer.close();
        resolve(Buffer.concat(chunks));
      } catch (e) {
        reject(e);
      }
    });

    // Enqueue with ML‐server; get back a Celery task_id
    embeddingResponse = await axios.post(
      'http://ml-api:5556/create_embeddings',
      parquetBuffer,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${shopName}.parquet"`,
          'X-Shop-Name': shopName,
        },
        timeout: 3600000,
      }
    );

    if (embeddingResponse.status === 200) {
      const { task_id: celeryTaskId } = embeddingResponse.data;
      // Store Celery ID but keep status=started
      await updateTaskStatus(taskId, 'started', {
        celeryTaskId,
        productsCount: products.length,
      });
      console.log(`Embeddings enqueued (Celery task ${celeryTaskId})`);
    } else {
      throw new Error('Embedding service enqueue failed with a non-200 response');
    }
  } catch (error) {
    console.error('Error creating embeddings:', error);
    await updateTaskStatus(taskId, 'failed', {
      errorMessage: error.message,
      errorDetails: error.toString(),
    });
  }
}

// Helper function to serialize data to Parquet in memory
async function serializeToParquet(data, schema) {
  return new Promise(async (resolve, reject) => {
    const chunks = [];
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    try {
      const writer = await ParquetWriter.openStream(schema, writable);
      for (const record of data) {
        await writer.appendRow(record);
      }
      await writer.close();

      // Combine all chunks into a single buffer
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    } catch (error) {
      reject(error);
    }
  });
}
