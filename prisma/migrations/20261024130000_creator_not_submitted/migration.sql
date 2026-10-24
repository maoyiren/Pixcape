-- Add the new value separately so PostgreSQL commits it before it is used by a default.
ALTER TYPE "CreatorReviewStatus" ADD VALUE IF NOT EXISTS 'NOT_SUBMITTED';
