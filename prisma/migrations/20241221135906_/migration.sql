-- AlterTable
ALTER TABLE "Chats" ADD COLUMN "threadId" TEXT;

-- CreateIndex
CREATE INDEX "Chats_createdAt_idx" ON "Chats"("createdAt");
