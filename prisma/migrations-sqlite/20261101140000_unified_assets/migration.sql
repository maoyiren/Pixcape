
CREATE TABLE "Asset" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerId" TEXT, "projectId" TEXT, "kind" TEXT NOT NULL,
 "category" TEXT, "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "byteSize" INTEGER NOT NULL,
 "width" INTEGER, "height" INTEGER, "sha256" TEXT, "source" TEXT NOT NULL,
 "visibility" TEXT NOT NULL DEFAULT 'PRIVATE', "licenseId" TEXT, "attribution" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");
CREATE INDEX "Asset_ownerId_category_updatedAt_idx" ON "Asset"("ownerId","category","updatedAt");
CREATE INDEX "Asset_projectId_updatedAt_idx" ON "Asset"("projectId","updatedAt");
CREATE INDEX "Asset_visibility_category_createdAt_idx" ON "Asset"("visibility","category","createdAt");
CREATE INDEX "Asset_sha256_idx" ON "Asset"("sha256");

CREATE TABLE "Outfit" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerId" TEXT NOT NULL, "name" TEXT NOT NULL, "skinAssetId" TEXT,
 "skinModel" TEXT NOT NULL DEFAULT 'CLASSIC', "background" TEXT, "pose" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "Outfit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Outfit_skinAssetId_fkey" FOREIGN KEY ("skinAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Outfit_ownerId_updatedAt_idx" ON "Outfit"("ownerId","updatedAt");
CREATE INDEX "Outfit_skinAssetId_idx" ON "Outfit"("skinAssetId");

CREATE TABLE "OutfitItem" (
 "id" TEXT NOT NULL PRIMARY KEY, "outfitId" TEXT NOT NULL, "assetId" TEXT NOT NULL, "category" TEXT NOT NULL,
 "sortOrder" INTEGER NOT NULL DEFAULT 0, "equipped" BOOLEAN NOT NULL DEFAULT TRUE,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "OutfitItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OutfitItem_outfitId_assetId_key" ON "OutfitItem"("outfitId","assetId");
CREATE INDEX "OutfitItem_assetId_idx" ON "OutfitItem"("assetId");
CREATE INDEX "OutfitItem_outfitId_sortOrder_idx" ON "OutfitItem"("outfitId","sortOrder");

CREATE TABLE "AssetFavorite" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AssetFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "AssetFavorite_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AssetFavorite_userId_assetId_key" ON "AssetFavorite"("userId","assetId");
CREATE INDEX "AssetFavorite_userId_createdAt_idx" ON "AssetFavorite"("userId","createdAt");
CREATE INDEX "AssetFavorite_assetId_idx" ON "AssetFavorite"("assetId");

CREATE TABLE "Publication" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerId" TEXT NOT NULL, "assetId" TEXT, "outfitId" TEXT,
 "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "publishedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "Publication_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Publication_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "Publication_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Publication_ownerId_updatedAt_idx" ON "Publication"("ownerId","updatedAt");
CREATE INDEX "Publication_status_publishedAt_idx" ON "Publication"("status","publishedAt");
CREATE INDEX "Publication_assetId_idx" ON "Publication"("assetId");
CREATE INDEX "Publication_outfitId_idx" ON "Publication"("outfitId");

CREATE TABLE "WorkspaceState" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "projectId" TEXT,
 "activeTool" TEXT NOT NULL DEFAULT 'WARDROBE', "activeAssetId" TEXT, "activeOutfitId" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "WorkspaceState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "WorkspaceState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkspaceState_userId_key" ON "WorkspaceState"("userId");
CREATE INDEX "WorkspaceState_projectId_idx" ON "WorkspaceState"("projectId");
