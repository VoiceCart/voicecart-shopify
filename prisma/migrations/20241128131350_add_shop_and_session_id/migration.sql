/*
  Warnings:

  - Added the required column `shop` to the `Threads` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Threads" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "threadId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Threads" ("createdAt", "id", "threadId", "userId") SELECT "createdAt", "id", "threadId", "userId" FROM "Threads";
DROP TABLE "Threads";
ALTER TABLE "new_Threads" RENAME TO "Threads";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
