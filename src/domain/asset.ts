import { z } from 'zod'

/**
 * Canonical asset vocabulary shared by wardrobe, editor, AI and community.
 * Keep shawls, coats and official-style capes distinct: they have different
 * UV layouts, rendering rules and export constraints.
 */
export const ASSET_CATEGORIES = [
  'SKIN',
  'SHAWL',
  'COAT',
  'CAPE',
  'HAT',
  'PANTS',
  'SHOES',
  'OTHER_ACCESSORY',
] as const

export const AssetCategorySchema = z.enum(ASSET_CATEGORIES)
export type AssetCategory = z.infer<typeof AssetCategorySchema>

export const AssetKindSchema = z.enum([
  'SKIN_TEXTURE',
  'CLOTHING_TEXTURE',
  'ACCESSORY_TEXTURE',
  'PROJECT_FILE',
  'PREVIEW_IMAGE',
])
export type AssetKind = z.infer<typeof AssetKindSchema>

export const SkinModelSchema = z.enum(['CLASSIC', 'SLIM'])
export type SkinModel = z.infer<typeof SkinModelSchema>

export const AssetSourceSchema = z.enum([
  'UPLOAD',
  'AI_GENERATION',
  'PIXEL_EDITOR',
  'IMPORT',
  'COMMUNITY',
])
export type AssetSource = z.infer<typeof AssetSourceSchema>

export const AssetVisibilitySchema = z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC'])
export type AssetVisibility = z.infer<typeof AssetVisibilitySchema>

/**
 * Metadata only. Binary files belong in controlled file/object storage;
 * database records must never use base64 as their durable storage format.
 */
export const AssetDescriptorSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1).nullable(),
  kind: AssetKindSchema,
  category: AssetCategorySchema.nullable(),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive().max(50 * 1024 * 1024),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  source: AssetSourceSchema,
  visibility: AssetVisibilitySchema,
  licenseId: z.string().min(1).nullable(),
  attribution: z.string().max(500).nullable(),
  createdAt: z.string().datetime(),
})
export type AssetDescriptor = z.infer<typeof AssetDescriptorSchema>

export const OutfitItemSchema = z.object({
  assetId: z.string().min(1),
  category: AssetCategorySchema.exclude(['SKIN']),
  order: z.number().int().min(0),
  equipped: z.boolean(),
})
export type OutfitItem = z.infer<typeof OutfitItemSchema>

export const OutfitSnapshotSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  skinAssetId: z.string().min(1).nullable(),
  skinModel: SkinModelSchema,
  items: z.array(OutfitItemSchema).max(64),
  background: z.string().max(80).nullable(),
  pose: z.string().max(80).nullable(),
  updatedAt: z.string().datetime(),
})
export type OutfitSnapshot = z.infer<typeof OutfitSnapshotSchema>

export const WorkspaceToolSchema = z.enum(['WARDROBE', 'PIXEL_EDITOR', 'AI_GENERATOR'])
export type WorkspaceTool = z.infer<typeof WorkspaceToolSchema>

/**
 * Portable cross-tool pointer state. Persisted IDs are authoritative;
 * client-side stores may cache this state but must not own the only copy.
 */
export const WorkspacePointerSchema = z.object({
  projectId: z.string().min(1).nullable(),
  activeTool: WorkspaceToolSchema,
  activeAssetId: z.string().min(1).nullable(),
  activeOutfitId: z.string().min(1).nullable(),
})
export type WorkspacePointer = z.infer<typeof WorkspacePointerSchema>
