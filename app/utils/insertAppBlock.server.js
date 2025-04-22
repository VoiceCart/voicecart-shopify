import { shopify } from "../shopify.server";

export async function insertAppBlock(session) {
  const client = new shopify.api.clients.Rest({ session });

  // 1. Получить список тем
  const themes = await client.get({ path: 'themes' });
  const mainTheme = themes.body.themes.find(t => t.role === 'main');
  if (!mainTheme) throw new Error("Main theme not found");

  // 2. Получить layout или шаблон
  const templateRes = await client.get({
    path: `themes/${mainTheme.id}/assets`,
    query: { 'asset[key]': 'templates/index.json' },
  });

  let templateJSON;
  try {
    templateJSON = JSON.parse(templateRes.body.asset.value);
  } catch (e) {
    throw new Error("Failed to parse template");
  }

  // 3. Вставить app block, если его нет
  const hasBlock = templateJSON.sections["main"]?.blocks?.some(
    (block) => block.type === "my-app-block::app-window"
  );

  if (!hasBlock) {
    templateJSON.sections["main"].blocks.push({
      type: "my-app-block::app-window",
      settings: {},
    });

    // 4. Сохранить обратно
    await client.put({
      path: `themes/${mainTheme.id}/assets`,
      data: {
        asset: {
          key: 'templates/index.json',
          value: JSON.stringify(templateJSON, null, 2),
        },
      },
      type: 'application/json',
    });

    console.log("✅ App block added to main theme.");
  } else {
    console.log("ℹ️ App block already present.");
  }
}
