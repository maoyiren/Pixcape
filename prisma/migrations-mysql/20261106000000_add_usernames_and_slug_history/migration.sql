ALTER TABLE `User` ADD COLUMN `username` VARCHAR(191) NULL;
UPDATE `User`
SET `username` = CONCAT('user-', LOWER(LEFT(`id`, 16)))
WHERE `username` IS NULL;
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);

CREATE TABLE `UserSlugHistory` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `username` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserSlugHistory_username_key` (`username`),
  INDEX `UserSlugHistory_userId_createdAt_idx` (`userId`, `createdAt`),
  CONSTRAINT `UserSlugHistory_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `UserSlugHistory` (`id`, `userId`, `username`, `createdAt`)
SELECT CONCAT('seed-', `id`), `id`, `username`, CURRENT_TIMESTAMP(3)
FROM `User`
WHERE `username` IS NOT NULL;
