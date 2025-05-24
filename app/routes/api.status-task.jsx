import { json } from "@remix-run/node";
import shopify from "../shopify.server";
import { fetchWithToken } from "../utils/fetchWithToken.client";

export async function loader({ request }) {
  try {
    const { session } = await shopify.authenticate.admin(request);
    const url = new URL(request.url);
    const taskId = url.searchParams.get("taskId");

    if (!taskId) {
      return json({ error: "Task ID is required" }, { status: 400 });
    }

    // Fetch task status from the ML server
    const mlServerResponse = await fetchWithToken(
      `http://ml-api:5556/task_status/${taskId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await mlServerResponse.json();

    // Map ML server response to frontend expected format
    const response = {
      status: data.status, // e.g., "pending", "started", "progress", "success", "error"
      progress: data.progress || 0, // Progress percentage (0-100)
      message: data.message || "Processing...", // Descriptive message
    };

    return json(response, { status: 200 });
  } catch (error) {
    console.error("Error fetching task status from ML server:", error);
    return json(
      { error: "Failed to fetch task status", message: error.message },
      { status: 500 }
    );
  }
}
