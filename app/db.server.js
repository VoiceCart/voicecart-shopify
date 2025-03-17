import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Utility function for formatting date as string
function formatDateAsString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Create a new task
export async function createTask(shopName, taskType) {
  const startDate = formatDateAsString(new Date());

  return prisma.task.create({
    data: {
      shopName,
      taskType,
      status: 'started',
      startDate,
    },
  });
}

// Update task status
export async function updateTaskStatus(taskId, status, additionalDetails = null) {
  const endDate = (status === 'success' || status === 'failed')
    ? formatDateAsString(new Date())
    : null;

  return await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      endDate,
      ...(additionalDetails && { additionalDetails: JSON.stringify(additionalDetails) })
    },
  });
}

// Get the latest task for a shop and specific task type
export async function getLatestTask(shopName, taskType) {
  return await prisma.task.findFirst({
    where: {
      shopName,
      taskType
    },
    orderBy: { startDate: 'desc' },
  });
}

// Get a task by ID
export async function getTaskById(taskId) {
  return await prisma.task.findUnique({
    where: { id: taskId },
  });
}

// Set or update the global language for a shop
export async function setGlobalLanguage(shop, language) {
  return await prisma.languages.upsert({
    where: { shop },
    update: { language },
    create: { shop, language },
  });
}

export default prisma;
