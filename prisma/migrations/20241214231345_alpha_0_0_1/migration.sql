/*
  Warnings:

  - The primary key for the `Threads` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `assistantName` on the `Threads` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `Threads` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Threads` table. All the data in the column will be lost.
  - Made the column `sessionId` on table `Threads` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Threads" (
    "threadId" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Threads" ("createdAt", "sessionId", "shop", "threadId") SELECT "createdAt", "sessionId", "shop", "threadId" FROM "Threads";
DROP TABLE "Threads";
ALTER TABLE "new_Threads" RENAME TO "Threads";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
