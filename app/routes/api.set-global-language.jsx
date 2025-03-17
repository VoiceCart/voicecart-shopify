import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { setGlobalLanguage } from "../db.server.js";

export async function action({ request }) {
  // Authenticate the admin to get the current shop name.
  const { admin } = await authenticate.admin(request);
  const shopName = admin.rest.session.shop;

  // Parse form data to get the language setting.
  const formData = await request.formData();
  const language = formData.get("language");

  if (!language || typeof language !== "string") {
    return json({ error: "Language not provided" }, { status: 400 });
  }

  try {
    // Set or update the global language for this shop.
    const updatedLanguage = await setGlobalLanguage(shopName, language);

    return json(
      { success: true, language: updatedLanguage.language },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error setting global language:", error);
    return json(
      { error: "Error setting global language" },
      { status: 500 }
    );
  }
}