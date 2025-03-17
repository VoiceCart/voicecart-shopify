// app/routes/api/status-task.jsx
import { json } from "@remix-run/node";
import { getTaskById } from "../db.server.js";

export async function loader({ params, request }) {
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");

  if (!taskId) {
    return json({ error: "Task ID is required" }, { status: 400 });
  }

  const task = await getTaskById(taskId);
  if (!task) {
    return json({ status: "Completed" }, { status: 200 }); // Или верните ошибку 404
  }

  return json({ status: task.status }, { status: 200 });
}
