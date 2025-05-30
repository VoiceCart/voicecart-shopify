import { json } from "@remix-run/node";
import { startProductFetchTask } from "../utils/shopifyProductFetch.server.js";
import { createEmbeddingsTask } from "../utils/createEmbedding.server.js";
import { deleteEmbeddingsTask } from "../utils/deleteEmbedding.server.js";
import { authenticate } from "../shopify.server";
import { createTask, getLatestTask } from "../db.server.js";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const shopName = admin.rest.session.shop;

  // Parse form data to get task type
  const formData = await request.formData();
  const taskType = formData.get('taskType');

  // Configurable cooldown periods for different task types
  const cooldownConfig = {
    'product-catalog': 0, // 7 days for product catalog
    'create-embeddings': 0, // 1 day for embeddings
    'delete-embeddings': 0
  };

  // Get latest task for this shop and task type
  const latestTask = await getLatestTask(shopName, taskType);

  // Set cooldown offset
  const reloadOffsetDays = cooldownConfig[taskType] || 0;
  const reloadOffsetDate = new Date();
  reloadOffsetDate.setDate(reloadOffsetDate.getDate() - reloadOffsetDays);

  if (latestTask) {
    const startedAt = new Date(latestTask.createdAt);
    const now = new Date();
    const minutesAgo = (now - startedAt) / 60000;
  
    if (latestTask.status === 'started' && minutesAgo < 30) {
      return json({
        error: `Another ${taskType} task is already in progress.`
      }, { status: 409 });
    }
  }

  // Create new task
  const newTask = await createTask(shopName, taskType);
  const taskId = newTask.id;

  // Start appropriate task based on type
  if (taskType === 'product-catalog') {
    startProductFetchTask(taskId, request);
  } else if (taskType === 'create-embeddings') {
    createEmbeddingsTask(taskId, request);
  } else if (taskType === 'delete-embeddings') {
    deleteEmbeddingsTask(taskId, request)
  } else {
    return json({ error: "Invalid task type" }, { status: 400 });
  }

  return json({ taskId, taskType }, { status: 202 });
}