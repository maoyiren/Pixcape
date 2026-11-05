-- Keep MySQL authentication schema aligned with the Prisma model.
ALTER TABLE `User` ADD COLUMN `passwordHash` VARCHAR(191) NULL;

CREATE TABLE `AppSetting` (
  `key` VARCHAR(191) NOT NULL,
  `value` VARCHAR(191) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
