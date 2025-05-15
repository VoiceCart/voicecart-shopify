import { json } from "@remix-run/node";
import { getTaskById } from "../db.server.js";
import shopify from "../shopify.server";

export async function loader({ request }) {
  try {
    const { session } = await shopify.authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const taskId = url.searchParams.get("taskId");

    if (!taskId) {
      return json({ error: "Task ID is required" }, { status: 400 });
    }

    const task = await getTaskById(taskId);
    if (!task) {
      return json({ status: "Completed" }, { status: 200 });
    }

    return json({ status: task.status }, { status: 200 });
  } catch (error) {
    console.error("Token validation or task lookup failed:", error);
    return json({ error: error.message || "Unauthorized or task error" }, { status: 401 });
  }
}
