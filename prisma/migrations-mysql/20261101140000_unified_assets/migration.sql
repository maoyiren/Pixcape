
CREATE TABLE `Asset` (
 `id` VARCHAR(191) NOT NULL, `ownerId` VARCHAR(191) NULL, `projectId` VARCHAR(191) NULL,
 `kind` ENUM('SKIN_TEXTURE','CLOTHING_TEXTURE','ACCESSORY_TEXTURE','PROJECT_FILE','PREVIEW_IMAGE') NOT NULL,
 `category` ENUM('SKIN','SHAWL','COAT','CAPE','HAT','PANTS','SHOES','OTHER_ACCESSORY') NULL,
 `storageKey` VARCHAR(191) NOT NULL, `mimeType` VARCHAR(191) NOT NULL, `byteSize` INTEGER NOT NULL,
 `width` INTEGER NULL, `height` INTEGER NULL, `sha256` VARCHAR(191) NULL,
 `source` ENUM('UPLOAD','AI_GENERATION','PIXEL_EDITOR','IMPORT','COMMUNITY') NOT NULL,
 `visibility` ENUM('PRIVATE','UNLISTED','PUBLIC') NOT NULL DEFAULT 'PRIVATE',
 `licenseId` VARCHAR(191) NULL, `attribution` VARCHAR(191) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `Asset_storageKey_key`(`storageKey`),
 INDEX `Asset_ownerId_category_updatedAt_idx`(`ownerId`,`category`,`updatedAt`),
 INDEX `Asset_projectId_updatedAt_idx`(`projectId`,`updatedAt`),
 INDEX `Asset_visibility_category_createdAt_idx`(`visibility`,`category`,`createdAt`),
 INDEX `Asset_sha256_idx`(`sha256`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Outfit` (
 `id` VARCHAR(191) NOT NULL, `ownerId` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL,
 `skinAssetId` VARCHAR(191) NULL, `skinModel` ENUM('CLASSIC','SLIM') NOT NULL DEFAULT 'CLASSIC',
 `background` VARCHAR(191) NULL, `pose` VARCHAR(191) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 INDEX `Outfit_ownerId_updatedAt_idx`(`ownerId`,`updatedAt`), INDEX `Outfit_skinAssetId_idx`(`skinAssetId`),
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OutfitItem` (
 `id` VARCHAR(191) NOT NULL, `outfitId` VARCHAR(191) NOT NULL, `assetId` VARCHAR(191) NOT NULL,
 `category` ENUM('SKIN','SHAWL','COAT','CAPE','HAT','PANTS','SHOES','OTHER_ACCESSORY') NOT NULL,
 `sortOrder` INTEGER NOT NULL DEFAULT 0, `equipped` BOOLEAN NOT NULL DEFAULT TRUE,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `OutfitItem_outfitId_assetId_key`(`outfitId`,`assetId`),
 INDEX `OutfitItem_assetId_idx`(`assetId`), INDEX `OutfitItem_outfitId_sortOrder_idx`(`outfitId`,`sortOrder`),
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AssetFavorite` (
 `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `assetId` VARCHAR(191) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `AssetFavorite_userId_assetId_key`(`userId`,`assetId`),
 INDEX `AssetFavorite_userId_createdAt_idx`(`userId`,`createdAt`), INDEX `AssetFavorite_assetId_idx`(`assetId`),
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Publication` (
 `id` VARCHAR(191) NOT NULL, `ownerId` VARCHAR(191) NOT NULL, `assetId` VARCHAR(191) NULL,
 `outfitId` VARCHAR(191) NULL, `title` VARCHAR(191) NOT NULL, `description` VARCHAR(191) NOT NULL DEFAULT '',
 `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT', `publishedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 INDEX `Publication_ownerId_updatedAt_idx`(`ownerId`,`updatedAt`), INDEX `Publication_status_publishedAt_idx`(`status`,`publishedAt`),
 INDEX `Publication_assetId_idx`(`assetId`), INDEX `Publication_outfitId_idx`(`outfitId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkspaceState` (
 `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `projectId` VARCHAR(191) NULL,
 `activeTool` VARCHAR(191) NOT NULL DEFAULT 'WARDROBE', `activeAssetId` VARCHAR(191) NULL,
 `activeOutfitId` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL, UNIQUE INDEX `WorkspaceState_userId_key`(`userId`),
 INDEX `WorkspaceState_projectId_idx`(`projectId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Asset` ADD CONSTRAINT `Asset_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Outfit` ADD CONSTRAINT `Outfit_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Outfit` ADD CONSTRAINT `Outfit_skinAssetId_fkey` FOREIGN KEY (`skinAssetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OutfitItem` ADD CONSTRAINT `OutfitItem_outfitId_fkey` FOREIGN KEY (`outfitId`) REFERENCES `Outfit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OutfitItem` ADD CONSTRAINT `OutfitItem_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssetFavorite` ADD CONSTRAINT `AssetFavorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssetFavorite` ADD CONSTRAINT `AssetFavorite_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Publication` ADD CONSTRAINT `Publication_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Publication` ADD CONSTRAINT `Publication_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Publication` ADD CONSTRAINT `Publication_outfitId_fkey` FOREIGN KEY (`outfitId`) REFERENCES `Outfit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `WorkspaceState` ADD CONSTRAINT `WorkspaceState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WorkspaceState` ADD CONSTRAINT `WorkspaceState_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
