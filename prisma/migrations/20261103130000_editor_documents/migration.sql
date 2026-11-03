CREATE TABLE "EditorDocument" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '未命名作品',
    "document" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EditorDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EditorDocument_ownerId_updatedAt_idx" ON "EditorDocument"("ownerId", "updatedAt");

ALTER TABLE "EditorDocument" ADD CONSTRAINT "EditorDocument_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
