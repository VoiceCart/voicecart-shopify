// app/utils/insertAppBlock.server.js

import { api } from "../shopify.server";

export async function insertAppBlock(session) {
  const client = new api.rest.client.Rest({ session });

  // 1. Получить список тем
  const themes = await client.get({ path: "themes" });
  const mainTheme = themes.body.themes.find((t) => t.role === "main");
  if (!mainTheme) throw new Error("Main theme not found");

  // 2. Получить шаблон главной страницы
  const templateRes = await client.get({
    path: `themes/${mainTheme.id}/assets`,
    query: { "asset[key]": "templates/index.json" },
  });

  let templateJSON;
  try {
    templateJSON = JSON.parse(templateRes.body.asset.value);
  } catch {
    throw new Error("Failed to parse template");
  }

  // 3. Проверить наличие блока
  const hasBlock = templateJSON.sections?.main?.blocks?.some(
    (block) => block.type === "my-app-block::app-window
