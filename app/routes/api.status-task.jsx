import { json } from "@remix-run/node";
import { getTaskById } from "../db.server.js";
import { api } from "../shopify.server";

export async function loader({ request }) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = await api.session.decodeSessionToken(token);
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
