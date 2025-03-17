import { json } from "@remix-run/node";
import { getTaskById } from "../db.server.js";

export async function loader({ params }) {
  const { taskId } = params;

  const task = await getTaskById(taskId);
  if (!task) {
    return json({ error: "Task not found" }, { status: 404 });
  }

  return json({ status: task.status }, { status: 200 });
}
