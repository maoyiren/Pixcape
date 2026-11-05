-- Keep SQLite authentication schema aligned with the Prisma model.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

CREATE TABLE "AppSetting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL
);
