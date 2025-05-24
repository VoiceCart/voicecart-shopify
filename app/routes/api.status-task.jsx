import { json } from "@remix-run/node";
import shopify from "../shopify.server";
import { fetchWithToken } from "../utils/fetchWithToken.server";

export async function action({ request }) {
  try {
    const { session } = await shopify.authenticate.admin(request);
    const formData = await request.formData();
    const taskType = formData.get("taskType");

    if (!taskType) {
      return json({ error: "Task type is required" }, { status: 400 });
    }

    const shop = session.shop;

    if (taskType === "create-embeddings") {
      console.log(`Creating embeddings for: ${shop}`);
      // Fetch products or relevant data (adjust based on your setup)
      const productsResponse = await fetchWithToken(`/api/products`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-Shop-Name": shop },
      });
      const products = await productsResponse.json();
      console.log(`Preparing to create embeddings for ${products.length} products`);

      // Send request to ML server
      const mlResponse = await fetchWithToken(
        `http://ml-api:5556/create_embeddings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shop-Name": shop,
          },
          body: JSON.stringify({ products }), // Adjust based on actual data
        }
      );

      const data = await mlResponse.json();

      if (!mlResponse.ok) {
        console.error("ML server error:", data);
        return json(
          { error: data.message || "Failed to start embedding task" },
          { status: mlResponse.status }
        );
      }

      console.log("Embedding service response:", data);
      // Return ML server's task_id and taskType
      return json({
        taskId: data.task_id,
        taskType,
        status: data.status, // e.g., "queued"
      });
    }

    // Handle other task types (e.g., product-catalog, delete-embeddings)
    return json({ error: "Unsupported task type" }, { status: 400 });
  } catch (error) {
    console.error("Error in start-task:", error);
    return json(
      { error: error.message || "Failed to process task" },
      { status: 500 }
    );
  }
}
