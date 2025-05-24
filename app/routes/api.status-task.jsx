import { json } from "@remix-run/node";
import { getTaskById, updateTaskStatus } from "../db.server.js";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    const shopName = admin.rest.session.shop.split('.')[0];
    const url = new URL(request.url);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) {
      return json({ error: "Task ID is required" }, { status: 400 });
    }

    const task = await getTaskById(taskId);
    if (!task) {
      return json({ status: "success", progress: 100, message: "" });
    }

    let details = {};
    try {
      details = JSON.parse(task.additionalDetails || "{}");
    } catch {}

    const celeryTaskId = details.celeryTaskId;
    if (!celeryTaskId) {
      return json({ status: task.status });
    }

    const mlRes = await fetch(
      `http://ml-api:5556/task_status/${celeryTaskId}`,
      { headers: { "X-Shop-Name": shopName } }
    );
    const mlData = await mlRes.json();

    if (mlData.status === "success" || mlData.status === "error") {
      await updateTaskStatus(
        taskId,
        mlData.status === "success" ? "success" : "failed",
        { celeryTaskId }
      );
    }

    return json(mlData);
  } catch (error) {
    console.error("Error fetching task status:", error);
    return json({ error: error.message }, { status: 500 });
  }
}
