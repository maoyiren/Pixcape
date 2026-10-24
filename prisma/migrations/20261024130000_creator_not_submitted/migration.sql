-- Creator identity is independent from optional verification. New profiles are not applications.
ALTER TYPE "CreatorReviewStatus" ADD VALUE IF NOT EXISTS 'NOT_SUBMITTED';
ALTER TABLE "CreatorProfile" ALTER COLUMN "reviewStatus" SET DEFAULT 'NOT_SUBMITTED';
