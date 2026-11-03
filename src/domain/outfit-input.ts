import { z } from 'zod'
import { AssetCategorySchema, SkinModelSchema } from './asset.ts'

const WearableCategorySchema = AssetCategorySchema.exclude(['SKIN'])

export const OutfitInputSchema = z.object({
  name: z.string().trim().min(1).max(80).default('未命名搭配'),
  skinAssetId: z.string().min(1).nullable().optional(),
  skinModel: SkinModelSchema.default('CLASSIC'),
  background: z.string().trim().max(80).nullable().optional(),
  pose: z.string().trim().max(80).nullable().optional(),
  items: z.array(z.object({
    assetId: z.string().min(1).max(128),
    category: WearableCategorySchema,
    sortOrder: z.number().int().min(0).max(1000).default(0),
    equipped: z.boolean().default(true),
  })).max(64).default([]),
}).strict().superRefine((value, context) => {
  const ids = value.items.map((item) => item.assetId)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: '同一件素材不能在一个搭配中重复添加。' })
  }
})

export type OutfitInput = z.infer<typeof OutfitInputSchema>
