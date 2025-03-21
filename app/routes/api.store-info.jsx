// app/routes/api.store-info.jsx
import { json } from "@remix-run/node";
import { fetchStoreInfoAndTags } from "../utils/shopifyStoreInfoFetch.server";

export async function loader({ request }) {
  try {
    const storeInfo = await fetchStoreInfoAndTags(request);
    return json(storeInfo);
  } catch (error) {
    const errorMessage = error.message || "Failed to fetch store info and tags";
    console.error("Detailed error in store-info API:", {
      message: errorMessage,
      stack: error.stack,
      error: error, // Логируем полный объект ошибки
    });
    return json({ error: errorMessage }, { status: 500 });
  }
}