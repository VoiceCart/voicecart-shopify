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
    console.log("Creating embeddings for: ", shopName)

    // Construct the path to the Parquet file
    const directoryPath = '..\\test\\app\\utils\\shopify_catalogs';
    const filePath = path.join(directoryPath, `${shopName}.parquet`);

    // Check if the Parquet file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('Product catalog not found. Please generate the catalog first.');
    }

    // Read the Parquet file
    const reader = await ParquetReader.openFile(filePath);
    const products = [];

    try {
      const cursor = reader.getCursor();
      let product;
      // Read each product from the Parquet file
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
      // Ensure the reader is closed
      await reader.close();
    }

    console.log(`Preparing to create embeddings for ${products.length} products`);

    // Serialize products to a Parquet file (in memory)
    const schema = new ParquetSchema({
      variantId: { type: 'UTF8' },
      name: { type: 'UTF8' },
      description: { type: 'UTF8' },
      category: { type: 'UTF8' },
      brand: { type: 'UTF8' },
      price: { type: 'DOUBLE' },
      handle: { type: 'UTF8' },
    });

    const parquetBuffer = await serializeToParquet(products, schema);

    // Send the Parquet file to the embedding service
    // TODO: embeding server call
    try {
      embeddingResponse = await axios.post(
        // 'https://z9dhmn7q6oagzp-5556.proxy.runpod.net/create_embeddings',
        'http://ml-api:5556/create_embeddings',
        //`${process.env.ML_SERVER_URL}/create_embeddings`,
        parquetBuffer, // Send the binary Parquet data
        {
          headers: {
            'Content-Type': 'application/octet-stream', // Indicate binary content
            'Content-Disposition': `attachment; filename="${shopName}.parquet"`,
            'X-Shop-Name': shopName,
          },
          timeout: 3600000, // 1-hour timeout
        }
      );

      console.log('Embedding service response:', embeddingResponse.data);
    } catch (error) {
      if (error.response) {
        console.error('Error response from Flask server:', {
          status: error.response.status,
          data: error.response.data,
        });
      } else if (error.request) {
        console.error('No response from Flask server:', error.request);
      } else {
        console.error('Error in request setup:', error.message);
      }
    }

    // Check response from the embedding service
    if (embeddingResponse && embeddingResponse.status === 200) {
      await updateTaskStatus(taskId, 'success', {
        productsProcessed: products.length,
        embeddingServiceResponse: embeddingResponse.data,
      });
      console.log('Embeddings created successfully');
    } else {
      throw new Error('Embedding creation failed with a non-200 response');
    }
  } catch (error) {
    console.error('Error creating embeddings:', error);

    // Update task status to failed with error details
    await updateTaskStatus(taskId, 'failed', JSON.stringify({
      errorMessage: error.message,
      errorDetails: error.toString(),
    }));

    // Rethrow the error to propagate it
    // throw error;
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
