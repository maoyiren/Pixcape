import { prisma } from '@/lib/prisma'
import { saveStorageConfiguration } from '../actions'
export const metadata = { title: '文件存储配置' }
export default async function AdminStoragePage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams
  const keys = ['STORAGE_S3_ENDPOINT','STORAGE_S3_BUCKET','STORAGE_S3_REGION','STORAGE_PUBLIC_BASE_URL','STORAGE_SECRET_ACCESS_KEY_ID','STORAGE_SECRET_ACCESS_KEY']
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } })
  const config = Object.fromEntries(rows.map((row) => [row.key,row.value]))
  const s3Ready = Boolean(config.STORAGE_S3_ENDPOINT && config.STORAGE_S3_BUCKET && config.STORAGE_SECRET_ACCESS_KEY_ID && config.STORAGE_SECRET_ACCESS_KEY)
  return <main className="inventory-shell">
    <section className="inventory-panel hero"><p className="eyebrow">SYSTEM / STORAGE</p><h1>文件存储</h1>
      {params?.saved === '1' ? <p role="status">S3 兼容存储配置已加密保存。</p> : null}
      {params?.error ? <p role="alert">{params.error === 'credentials_required' ? '启用 S3 前必须提供完整的 Access Key ID 和 Secret Access Key；已有凭据可留空保留。' : '存储配置无效，请检查 HTTPS 地址、Bucket 名称和字段。'}</p> : null}
      <p>配置 S3 兼容对象存储。Access Key 和 Secret Key 只显示配置状态，不回显凭据。</p><p role="status">当前新上传：{s3Ready ? '使用 S3 兼容对象存储' : '使用服务器本地持久化目录'}。已有素材按各自 storageKey 保存的位置读取，不会因启用 S3 而丢失本地文件映射。</p>
      <div className="admin-overview"><article><span>Endpoint</span><strong>{config.STORAGE_S3_ENDPOINT ? '已配置' : '未配置'}</strong></article><article><span>Bucket</span><strong>{config.STORAGE_S3_BUCKET ? '已配置' : '未配置'}</strong></article><article><span>Access Key</span><strong>{config.STORAGE_SECRET_ACCESS_KEY_ID ? '已配置' : '未配置'}</strong></article><article><span>Secret Key</span><strong>{config.STORAGE_SECRET_ACCESS_KEY ? '已配置' : '未配置'}</strong></article></div>
    </section>
    <section className="inventory-panel hero"><h2>S3 兼容存储</h2>
      <form action={saveStorageConfiguration} className="application-form cdpc-stack">
        <label htmlFor="storage-endpoint">Endpoint（HTTPS）</label><input id="storage-endpoint" name="endpoint" type="url" required defaultValue={config.STORAGE_S3_ENDPOINT ?? ''} placeholder="https://s3.example.com"/>
        <label htmlFor="storage-bucket">Bucket 名称</label><input id="storage-bucket" name="bucket" required maxLength={128} defaultValue={config.STORAGE_S3_BUCKET ?? ''}/>
        <label htmlFor="storage-region">Region</label><input id="storage-region" name="region" defaultValue={config.STORAGE_S3_REGION ?? ''}/>
        <label htmlFor="storage-public-url">公开访问基础 URL（可选，HTTPS）</label><input id="storage-public-url" name="publicBaseUrl" type="url" defaultValue={config.STORAGE_PUBLIC_BASE_URL ?? ''}/>
        <label htmlFor="storage-access-key">Access Key ID（首次配置必填，留空保留）</label><input id="storage-access-key" name="accessKeyId" type="password" autoComplete="new-password" maxLength={2048} required={!config.STORAGE_SECRET_ACCESS_KEY_ID}/>
        <label htmlFor="storage-secret-key">Secret Access Key（首次配置必填，留空保留）</label><input id="storage-secret-key" name="secretAccessKey" type="password" autoComplete="new-password" maxLength={2048} required={!config.STORAGE_SECRET_ACCESS_KEY}/>
        <button className="pixel-button primary" type="submit">保存存储配置</button>
      </form>
    </section>
    <section className="inventory-panel hero"><h2>运行时接入说明</h2><p>完整配置后，新素材会直接上传到 S3，下载和删除也会通过 S3 签名请求完成；未配置时继续使用本地目录。每条素材的 storageKey 标记其存储后端，因此启用 S3 不会让已有本地素材失效。当前仍需在真实 Bucket 上验证凭据、权限、CORS（如浏览器直连）及生命周期策略。</p></section>
  </main>
}