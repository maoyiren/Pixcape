import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma-postgresql/index.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { OutfitInputSchema } from '../../src/domain/outfit-input.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required for integration tests.')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

test('asset visibility, outfit ownership, distinct clothing categories, and cascade lifecycle', async () => {
  const suffix = randomUUID()
  const email = (name) => `${name}-${suffix}@pixcape-test.invalid`
  const storageKey = (name) => `assets/integration-${suffix}-${name}.png`
  const createdUserIds = []
  const createdAssetIds = []
  let outfitId

  try {
    const [owner, other, creator] = await Promise.all([
      prisma.user.create({ data: { email: email('owner'), name: 'Wardrobe Owner' } }),
      prisma.user.create({ data: { email: email('other'), name: 'Other User' } }),
      prisma.user.create({ data: { email: email('creator'), name: 'Public Creator', role: 'CREATOR' } }),
    ])
    createdUserIds.push(owner.id, other.id, creator.id)

    const [skin, shawl, coat, cape, publicShoes, foreignPrivate] = await Promise.all([
      prisma.asset.create({ data: { ownerId: owner.id, kind: 'SKIN_TEXTURE', category: 'SKIN', storageKey: storageKey('skin'), mimeType: 'image/png', byteSize: 128, width: 64, height: 64, source: 'UPLOAD' } }),
      prisma.asset.create({ data: { ownerId: owner.id, kind: 'CLOTHING_TEXTURE', category: 'SHAWL', storageKey: storageKey('shawl'), mimeType: 'image/png', byteSize: 128, width: 64, height: 64, source: 'UPLOAD' } }),
      prisma.asset.create({ data: { ownerId: owner.id, kind: 'CLOTHING_TEXTURE', category: 'COAT', storageKey: storageKey('coat'), mimeType: 'image/png', byteSize: 128, width: 64, height: 64, source: 'UPLOAD' } }),
      prisma.asset.create({ data: { ownerId: owner.id, kind: 'CLOTHING_TEXTURE', category: 'CAPE', storageKey: storageKey('cape'), mimeType: 'image/png', byteSize: 128, width: 64, height: 64, source: 'UPLOAD' } }),
      prisma.asset.create({ data: { ownerId: creator.id, kind: 'ACCESSORY_TEXTURE', category: 'SHOES', storageKey: storageKey('public-shoes'), mimeType: 'image/png', byteSize: 128, width: 64, height: 64, source: 'UPLOAD', visibility: 'PUBLIC' } }),
      prisma.asset.create({ data: { ownerId: creator.id, kind: 'ACCESSORY_TEXTURE', category: 'HAT', storageKey: storageKey('private-hat'), mimeType: 'image/png', byteSize: 128, width: 64, height: 64, source: 'UPLOAD', visibility: 'PRIVATE' } }),
    ])
    createdAssetIds.push(skin.id, shawl.id, coat.id, cape.id, publicShoes.id, foreignPrivate.id)

    const visibleToOther = await prisma.asset.findMany({
      where: { id: { in: createdAssetIds }, OR: [{ ownerId: other.id }, { visibility: 'PUBLIC' }] },
      select: { id: true },
    })
    assert.deepEqual(visibleToOther.map((asset) => asset.id), [publicShoes.id], 'another user may discover only public assets')

    const input = OutfitInputSchema.parse({
      name: 'Three-layer outfit',
      skinAssetId: skin.id,
      skinModel: 'CLASSIC',
      items: [
        { assetId: shawl.id, category: 'SHAWL', sortOrder: 0, equipped: true },
        { assetId: coat.id, category: 'COAT', sortOrder: 1, equipped: true },
        { assetId: cape.id, category: 'CAPE', sortOrder: 2, equipped: true },
        { assetId: publicShoes.id, category: 'SHOES', sortOrder: 3, equipped: true },
      ],
    })
    assert.deepEqual(input.items.map((item) => item.category), ['SHAWL', 'COAT', 'CAPE', 'SHOES'])

    const outfit = await prisma.outfit.create({
      data: {
        ownerId: owner.id,
        name: input.name,
        skinAssetId: input.skinAssetId,
        skinModel: input.skinModel,
        items: { create: input.items.map((item) => ({
          assetId: item.assetId,
          category: item.category,
          sortOrder: item.sortOrder,
          equipped: item.equipped,
        })) },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
    outfitId = outfit.id
    assert.equal(outfit.items.length, 4)
    assert.deepEqual(outfit.items.map((item) => item.category), ['SHAWL', 'COAT', 'CAPE', 'SHOES'])

    assert.equal(await prisma.outfit.findFirst({ where: { id: outfit.id, ownerId: other.id } }), null, 'outfit reads must be owner-scoped')
    const foreignUpdate = await prisma.outfit.updateMany({
      where: { id: outfit.id, ownerId: other.id },
      data: { name: 'unauthorized overwrite' },
    })
    assert.equal(foreignUpdate.count, 0, 'another user cannot update an outfit')
    const foreignDelete = await prisma.outfit.deleteMany({ where: { id: outfit.id, ownerId: other.id } })
    assert.equal(foreignDelete.count, 0, 'another user cannot delete an outfit')

    await prisma.asset.delete({ where: { id: shawl.id } })
    const afterAssetDelete = await prisma.outfit.findUnique({
      where: { id: outfit.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
    assert.ok(afterAssetDelete, 'deleting a referenced asset must not delete the outfit')
    assert.deepEqual(afterAssetDelete.items.map((item) => item.category), ['COAT', 'CAPE', 'SHOES'], 'asset deletion must cascade only the matching outfit item')
  } finally {
    if (outfitId) await prisma.outfit.deleteMany({ where: { id: outfitId } })
    if (createdAssetIds.length) await prisma.asset.deleteMany({ where: { id: { in: createdAssetIds } } })
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
})

test.after(async () => { await prisma.$disconnect() })
