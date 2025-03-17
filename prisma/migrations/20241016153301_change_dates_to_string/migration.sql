-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DownloadTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopName" TEXT NOT NULL,
    "startDownloadDate" TEXT NOT NULL,
    "endDownloadDate" TEXT,
    "status" TEXT NOT NULL
);
INSERT INTO "new_DownloadTask" ("endDownloadDate", "id", "shopName", "startDownloadDate", "status") SELECT "endDownloadDate", "id", "shopName", "startDownloadDate", "status" FROM "DownloadTask";
DROP TABLE "DownloadTask";
ALTER TABLE "new_DownloadTask" RENAME TO "DownloadTask";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
