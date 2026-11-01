
CREATE TYPE "AssetCategory" AS ENUM ('SKIN','SHAWL','COAT','CAPE','HAT','PANTS','SHOES','OTHER_ACCESSORY');
CREATE TYPE "AssetKind" AS ENUM ('SKIN_TEXTURE','CLOTHING_TEXTURE','ACCESSORY_TEXTURE','PROJECT_FILE','PREVIEW_IMAGE');
CREATE TYPE "AssetSource" AS ENUM ('UPLOAD','AI_GENERATION','PIXEL_EDITOR','IMPORT','COMMUNITY');
CREATE TYPE "AssetVisibility" AS ENUM ('PRIVATE','UNLISTED','PUBLIC');
CREATE TYPE "SkinModel" AS ENUM ('CLASSIC','SLIM');

CREATE TABLE "Asset" (
 "id" TEXT NOT NULL, "ownerId" TEXT, "projectId" TEXT, "kind" "AssetKind" NOT NULL,
 "category" "AssetCategory", "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
 "byteSize" INTEGER NOT NULL, "width" INTEGER, "height" INTEGER, "sha256" TEXT,
 "source" "AssetSource" NOT NULL, "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
 "licenseId" TEXT, "attribution" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");
CREATE INDEX "Asset_ownerId_category_updatedAt_idx" ON "Asset"("ownerId","category","updatedAt");
CREATE INDEX "Asset_projectId_updatedAt_idx" ON "Asset"("projectId","updatedAt");
CREATE INDEX "Asset_visibility_category_createdAt_idx" ON "Asset"("visibility","category","createdAt");
CREATE INDEX "Asset_sha256_idx" ON "Asset"("sha256");

CREATE TABLE "Outfit" (
 "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "name" TEXT NOT NULL, "skinAssetId" TEXT,
 "skinModel" "SkinModel" NOT NULL DEFAULT 'CLASSIC', "background" TEXT, "pose" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Outfit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Outfit_ownerId_updatedAt_idx" ON "Outfit"("ownerId","updatedAt");
CREATE INDEX "Outfit_skinAssetId_idx" ON "Outfit"("skinAssetId");

CREATE TABLE "OutfitItem" (
 "id" TEXT NOT NULL, "outfitId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
 "category" "AssetCategory" NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0,
 "equipped" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OutfitItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutfitItem_outfitId_assetId_key" ON "OutfitItem"("outfitId","assetId");
CREATE INDEX "OutfitItem_assetId_idx" ON "OutfitItem"("assetId");
CREATE INDEX "OutfitItem_outfitId_sortOrder_idx" ON "OutfitItem"("outfitId","sortOrder");

CREATE TABLE "AssetFavorite" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AssetFavorite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetFavorite_userId_assetId_key" ON "AssetFavorite"("userId","assetId");
CREATE INDEX "AssetFavorite_userId_createdAt_idx" ON "AssetFavorite"("userId","createdAt");
CREATE INDEX "AssetFavorite_assetId_idx" ON "AssetFavorite"("assetId");

CREATE TABLE "Publication" (
 "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "assetId" TEXT, "outfitId" TEXT,
 "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Publication_ownerId_updatedAt_idx" ON "Publication"("ownerId","updatedAt");
CREATE INDEX "Publication_status_publishedAt_idx" ON "Publication"("status","publishedAt");
CREATE INDEX "Publication_assetId_idx" ON "Publication"("assetId");
CREATE INDEX "Publication_outfitId_idx" ON "Publication"("outfitId");

CREATE TABLE "WorkspaceState" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT,
 "activeTool" TEXT NOT NULL DEFAULT 'WARDROBE', "activeAssetId" TEXT, "activeOutfitId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WorkspaceState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceState_userId_key" ON "WorkspaceState"("userId");
CREATE INDEX "WorkspaceState_projectId_idx" ON "WorkspaceState"("projectId");

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Outfit" ADD CONSTRAINT "Outfit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Outfit" ADD CONSTRAINT "Outfit_skinAssetId_fkey" FOREIGN KEY ("skinAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetFavorite" ADD CONSTRAINT "AssetFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetFavorite" ADD CONSTRAINT "AssetFavorite_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkspaceState" ADD CONSTRAINT "WorkspaceState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceState" ADD CONSTRAINT "WorkspaceState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
