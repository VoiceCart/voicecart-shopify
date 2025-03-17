/*
  Warnings:

  - You are about to drop the `DownloadTask` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `assistantName` to the `Threads` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DownloadTask";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopName" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "additionalDetails" TEXT
);

-- CreateTable
CREATE TABLE "Chats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "query" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Threads" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "threadId" TEXT NOT NULL,
    "assistantName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Threads" ("createdAt", "id", "sessionId", "shop", "threadId", "userId") SELECT "createdAt", "id", "sessionId", "shop", "threadId", "userId" FROM "Threads";
DROP TABLE "Threads";
ALTER TABLE "new_Threads" RENAME TO "Threads";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
