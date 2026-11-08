import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma-postgresql/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required for integration tests.')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

test('project documents persist with owner isolation, asset ownership, and optimistic revision locking', async () => {
  const suffix = randomUUID()
  const email = (name) => `${name}-${suffix}@pixcape-test.invalid`
  const storageKey = (name) => `assets/project-${suffix}-${name}.png`
  const userIds = []
  const assetIds = []
  const projectIds = []

  try {
    const [owner, other] = await Promise.all([
      prisma.user.create({ data: { email: email('owner'), name: 'Project Owner' } }),
      prisma.user.create({ data: { email: email('other'), name: 'Other User' } }),
    ])
    userIds.push(owner.id, other.id)

    const [ownedAsset, foreignAsset] = await Promise.all([
      prisma.asset.create({ data: { ownerId: owner.id, kind: 'CLOTHING_TEXTURE', category: 'COAT', storageKey: storageKey('owned'), mimeType: 'image/png', byteSize: 128, width: 64, height: 64, source: 'UPLOAD' } }),
      prisma.asset.create({ data: { ownerId: other.id, kind: 'CLOTHING_TEXTURE', category: 'COAT', storageKey: storageKey('foreign'), mimeType: 'image/png', byteSize: 128, width: 64, height: 64, source: 'UPLOAD' } }),
    ])
    assetIds.push(ownedAsset.id, foreignAsset.id)

    const document = {
      version: 1,
      workspace: { activeTool: 'WARDROBE', skinModel: 'CLASSIC' },
      outfit: { name: 'Cloud restore outfit', items: [{ assetId: ownedAsset.id, category: 'COAT' }] },
      editor: { width: 64, height: 64, layers: [] },
    }
    const project = await prisma.project.create({
      data: { ownerId: owner.id, title: 'Cross-device project', description: 'Persisted project', visibility: 'PRIVATE', document: JSON.stringify(document) },
    })
    projectIds.push(project.id)
    await prisma.asset.update({ where: { id: ownedAsset.id }, data: { projectId: project.id } })

    const restored = await prisma.project.findFirst({
      where: { id: project.id, ownerId: owner.id },
      include: { assets: { select: { id: true, category: true } } },
    })
    assert.ok(restored)
    assert.equal(restored.revision, 1)
    assert.deepEqual(JSON.parse(restored.document), document, 'project JSON must round-trip without losing workspace and editor state')
    assert.deepEqual(restored.assets.map((asset) => asset.id), [ownedAsset.id])

    assert.equal(await prisma.project.findFirst({ where: { id: project.id, ownerId: other.id } }), null, 'another account must not restore a private project')
    assert.equal(await prisma.asset.count({ where: { id: foreignAsset.id, ownerId: owner.id } }), 0, 'foreign asset ids must not pass owner checks')

    const competingWrites = await Promise.all([
      prisma.project.updateMany({
        where: { id: project.id, ownerId: owner.id, revision: 1 },
        data: { title: 'First writer', document: JSON.stringify({ writer: 1 }), revision: { increment: 1 } },
      }),
      prisma.project.updateMany({
        where: { id: project.id, ownerId: owner.id, revision: 1 },
        data: { title: 'Second writer', document: JSON.stringify({ writer: 2 }), revision: { increment: 1 } },
      }),
    ])
    assert.deepEqual(competingWrites.map((result) => result.count).sort(), [0, 1], 'only one writer may update a given revision')
    const afterConflict = await prisma.project.findUnique({ where: { id: project.id } })
    assert.equal(afterConflict.revision, 2)
    assert.ok(['First writer', 'Second writer'].includes(afterConflict.title))
    assert.deepEqual(JSON.parse(afterConflict.document), { writer: afterConflict.title === 'First writer' ? 1 : 2 })

    const unauthorizedWrite = await prisma.project.updateMany({
      where: { id: project.id, ownerId: other.id, revision: 2 },
      data: { title: 'Unauthorized', revision: { increment: 1 } },
    })
    assert.equal(unauthorizedWrite.count, 0, 'foreign account cannot overwrite the project even with the current revision')
  } finally {
    if (projectIds.length) await prisma.project.deleteMany({ where: { id: { in: projectIds } } })
    if (assetIds.length) await prisma.asset.deleteMany({ where: { id: { in: assetIds } } })
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
})

test.after(async () => { await prisma.$disconnect() })
