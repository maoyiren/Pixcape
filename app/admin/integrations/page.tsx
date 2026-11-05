import { prisma } from '@/lib/prisma'
import { saveIntegrationConfiguration } from '../actions'
export const metadata = { title: '平台集成配置' }
export default async function AdminIntegrationsPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams
  const keys = ['PLATFORM_INTEGRATION_NAME','PLATFORM_WEBHOOK_URL','PLATFORM_SECRET_WEBHOOK_TOKEN']
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } })
  const config = Object.fromEntries(rows.map((row) => [row.key,row.value]))
  return <main className="inventory-shell">
    <section className="inventory-panel hero"><p className="eyebrow">SYSTEM / INTEGRATIONS</p><h1>平台集成</h1>
      {params?.saved === '1' ? <p role="status">集成配置已加密保存。</p> : null}
      {params?.error ? <p role="alert">配置无效，请填写名称和 HTTPS Webhook 地址。</p> : null}
      <p>为外部平台保存独立的 HTTPS Webhook 连接信息。敏感地址和令牌不会在页面回显。</p>
      <div className="config-status">当前集成：{config.PLATFORM_INTEGRATION_NAME || '尚未命名'} · Webhook {config.PLATFORM_WEBHOOK_URL ? '已保存' : '未配置'} · Token {config.PLATFORM_SECRET_WEBHOOK_TOKEN ? '已保存' : '未配置'}</div>
    </section>
    <section className="inventory-panel hero"><h2>Webhook 集成</h2>
      <form action={saveIntegrationConfiguration} className="application-form cdpc-stack">
        <label htmlFor="integration-name">集成名称</label><input id="integration-name" name="integrationName" required maxLength={80} defaultValue={config.PLATFORM_INTEGRATION_NAME ?? ''} placeholder="例如 Discord 通知"/>
        <label htmlFor="webhook-url">Webhook URL（保存时加密）</label><input id="webhook-url" name="webhookUrl" type="url" required maxLength={300} placeholder="https://hooks.example.com/..."/>
        <label htmlFor="webhook-secret">Webhook Token（可选，留空保留）</label><input id="webhook-secret" name="webhookSecret" type="password" autoComplete="new-password" maxLength={2048}/>
        <label><input type="checkbox" name="clearWebhookSecret"/> 清除 Token</label>
        <button className="pixel-button primary" type="submit">保存集成</button>
      </form>
    </section>
    <section className="inventory-panel hero"><h2>接入边界</h2><p>当前模块建立安全配置存储和审计记录。Webhook 事件分发器尚未连接，因此保存后不会自动发送通知；完成签名、重试、超时和投递日志后才算真正启用。</p></section>
  </main>
}