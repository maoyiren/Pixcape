-- Creator identity is independent from optional verification. New profiles are not applications.
ALTER TABLE `CreatorProfile` MODIFY `reviewStatus` ENUM('NOT_SUBMITTED','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NOT_SUBMITTED';
