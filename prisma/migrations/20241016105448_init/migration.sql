-- CreateTable
CREATE TABLE "DownloadTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopName" TEXT NOT NULL,
    "startDownloadDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDownloadDate" DATETIME,
    "status" TEXT NOT NULL
);
