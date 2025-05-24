// app/utils/createEmbedding.server.js

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { authenticate } from "../shopify.server";
import { updateTaskStatus } from '../db.server';
import pkg from 'parquetjs-lite';
const { ParquetReader, ParquetWriter, ParquetSchema } = pkg;
import { Writable } from 'stream';

export async function createEmbeddingsTask(taskId, request) {
  try {
    // 1) Auth
    const { admin } = await authenticate.admin(request);
    const shopDomain = admin.rest.session.shop;
    const shopName = shopDomain.split('.')[0];

    // 2) Правильный путь к parquet-файлу
    //    __dirname === .../app/utils
    const catalogDir = path.join(__dirname, 'shopify_catalogs');
    const filePath   = path.join(catalogDir, `${shopName}.parquet`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Parquet не найден по пути ${filePath}`);
    }

    // 3) Читаем Parquet
    const reader = await ParquetReader.openFile(filePath);
    const products = [];
    try {
      const cursor = reader.getCursor();
      let rec;
      while ((rec = await cursor.next())) {
        products.push({
          variantId:  rec.variantId,
          name:       rec.name,
          description:rec.description,
          category:   rec.category,
          brand:      rec.brand,
          price:      rec.price,
          handle:     rec.handle,
        });
      }
    } finally {
      await reader.close();
    }

    // 4) Сериализуем в память
    const schema = new ParquetSchema({
      variantId:  { type: 'UTF8' },
      name:       { type: 'UTF8' },
      description:{ type: 'UTF8' },
      category:   { type: 'UTF8' },
      brand:      { type: 'UTF8' },
      price:      { type: 'DOUBLE' },
      handle:     { type: 'UTF8' },
    });
    const parquetBuffer = await new Promise(async (resolve, reject) => {
      const chunks = [];
      const writable = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk);
          cb();
        }
      });
      try {
        const writer = await ParquetWriter.openStream(schema, writable);
        for (const row of products) {
          await writer.appendRow(row);
        }
        await writer.close();
        resolve(Buffer.concat(chunks));
      } catch (err) {
        reject(err);
      }
    });

    // 5) POST в ML‐сервис
    const resp = await axios.post(
      'http://ml-api:5556/create_embeddings',
      parquetBuffer,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Shop-Name': shopName
        },
        timeout: 3600000,
      }
    );
    if (resp.status !== 200 || !resp.data.task_id) {
      throw new Error(`ML-сервис вернул ${resp.status}`);
    }

    // 6) Сохраняем real Celery task_id
    await updateTaskStatus(taskId, 'started', {
      celeryTaskId: resp.data.task_id
    });

  } catch (err) {
    console.error("createEmbeddingsTask error:", err);
    await updateTaskStatus(taskId, 'failed', {
      errorMessage: err.message,
      errorStack:   err.stack,
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
