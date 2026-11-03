CREATE TABLE `EditorDocument` (
  `id` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL DEFAULT '未命名作品',
  `document` LONGTEXT NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `EditorDocument_ownerId_updatedAt_idx` (`ownerId`, `updatedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `EditorDocument_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
