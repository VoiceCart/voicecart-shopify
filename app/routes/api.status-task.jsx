import { json } from "@remix-run/node";
import { getTaskById, updateTaskStatus } from "../db.server.js";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    // 1) Authenticate admin + get shop
    const { admin } = await authenticate.admin(request);
    const shopName = admin.rest.session.shop.split(".")[0];

    // 2) Grab our internal taskId param
    const url = new URL(request.url);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) {
      return json({ error: "Task ID is required" }, { status: 400 });
    }

    // 3) Load from Prisma
    const task = await getTaskById(taskId);
    if (!task) {
      // no record => assume done
      return json({ status: "success", progress: 100, message: "" }, { status: 200 });
    }

    // 4) Parse out saved celeryTaskId
    let details = {};
    try {
      details = JSON.parse(task.additionalDetails || "{}");
    } catch {
      details = {};
    }
    const celeryTaskId = details.celeryTaskId;

    // 5) If none, just return our DB status
    if (!celeryTaskId) {
      return json({ status: task.status }, { status: 200 });
    }

    // 6) Poll the ML server
    const res = await fetch(
      `http://ml-api:5556/task_status/${celeryTaskId}`,
      { headers: { "X-Shop-Name": shopName } }
    );
    const mlData = await res.json(); // { status, progress, message }

    // 7) Persist final
    if (mlData.status === "success" || mlData.status === "error") {
      await updateTaskStatus(
        taskId,
        mlData.status === "success" ? "success" : "failed",
        { celeryTaskId }
      );
    }

    // 8) Return ML’s response
    return json(mlData, { status: 200 });
  } catch (error) {
    console.error("Error fetching task status:", error);
    return json({ error: error.message }, { status: 500 });
  }
}
