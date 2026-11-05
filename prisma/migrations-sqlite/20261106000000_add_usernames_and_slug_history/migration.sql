ALTER TABLE "User" ADD COLUMN "username" TEXT;
UPDATE "User"
SET "username" = 'user-' || lower(substr("id", 1, 12))
WHERE "username" IS NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

CREATE TABLE "UserSlugHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSlugHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserSlugHistory_username_key" ON "UserSlugHistory"("username");
CREATE INDEX "UserSlugHistory_userId_createdAt_idx" ON "UserSlugHistory"("userId", "createdAt");

INSERT INTO "UserSlugHistory" ("id", "userId", "username", "createdAt")
SELECT 'seed-' || "id", "id", "username", CURRENT_TIMESTAMP
FROM "User"
WHERE "username" IS NOT NULL;
