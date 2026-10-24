-- The enum value is now committed by the preceding migration.
ALTER TABLE "CreatorProfile" ALTER COLUMN "reviewStatus" SET DEFAULT 'NOT_SUBMITTED';
