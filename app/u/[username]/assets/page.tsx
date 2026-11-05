import PublishButton from '../creations/publish-button'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireUserSpaceOwner } from '@/lib/user-space'

export default async function PersonalAssetsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await requireUserSpaceOwner(username, '/assets')
  const assets = await prisma.asset.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: { id: true, category: true, attribution: true, visibility: true, updatedAt: true },
  })
  return <section><h1>我的素材</h1>{assets.length ? <ul>{assets.map(asset => <li key={asset.id}>
    <Link href={`/asset/${asset.id}`}>{asset.attribution || asset.category || '未命名素材'}</Link>
    <small> · {asset.category || '未分类'} · {asset.visibility === 'PUBLIC' ? '公开' : asset.visibility === 'UNLISTED' ? '不公开列出' : '私人'}</small> · <PublishButton kind="asset" id={asset.id} title={asset.attribution || asset.category || 'CDPC 素材'} />
  </li>)}</ul> : <p>你还没有上传素材。可以先去 <Link href="/studio">Studio</Link> 或衣橱上传。</p>}</section>
}
