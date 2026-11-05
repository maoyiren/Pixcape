import { prisma } from '@/lib/prisma'
import { saveMailConfiguration } from '../actions'
export const metadata = { title: '邮件服务配置' }
export default async function AdminMailPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams
  const keys = ['MAIL_SMTP_HOST','MAIL_SMTP_PORT','MAIL_SMTP_USER','MAIL_FROM','MAIL_SMTP_SECURE','MAIL_SECRET_SMTP_PASSWORD']
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } })
  const config = Object.fromEntries(rows.map((row) => [row.key,row.value]))
  return <main className="inventory-shell">
    <section className="inventory-panel hero"><p className="eyebrow">SYSTEM / MAIL</p><h1>邮件服务</h1>
      {params?.saved === '1' ? <p role="status">邮件配置已加密保存。认证邮件的运行时接入仍需完成验证。</p> : null}
      {params?.error ? <p role="alert">配置无效，请检查 SMTP 主机、端口和发件人地址。</p> : null}
      <p>集中管理 SMTP 参数。密码只显示是否已配置，绝不回显明文。</p>
      <div className="config-status">SMTP 密码：{config.MAIL_SECRET_SMTP_PASSWORD ? '已保存加密值' : '未配置'}</div>
    </section>
    <section className="inventory-panel hero"><h2>SMTP 服务器</h2>
      <form action={saveMailConfiguration} className="application-form cdpc-stack">
        <label htmlFor="smtp-host">SMTP 主机</label><input id="smtp-host" name="smtpHost" required maxLength={255} defaultValue={config.MAIL_SMTP_HOST ?? ''} placeholder="smtp.example.com"/>
        <label htmlFor="smtp-port">端口</label><input id="smtp-port" name="smtpPort" required inputMode="numeric" defaultValue={config.MAIL_SMTP_PORT ?? '587'}/>
        <label htmlFor="smtp-user">用户名</label><input id="smtp-user" name="smtpUser" maxLength={255} defaultValue={config.MAIL_SMTP_USER ?? ''}/>
        <label htmlFor="smtp-password">密码（留空保留现有值）</label><input id="smtp-password" name="smtpPassword" type="password" autoComplete="new-password" maxLength={2048}/>
        <label><input type="checkbox" name="clearSmtpPassword"/> 清除已保存密码</label>
        <label htmlFor="mail-from">发件人邮箱</label><input id="mail-from" name="mailFrom" type="email" required defaultValue={config.MAIL_FROM ?? ''}/>
        <label htmlFor="smtp-secure">TLS 模式</label><select id="smtp-secure" name="smtpSecure" defaultValue={config.MAIL_SMTP_SECURE ?? 'false'}><option value="false">STARTTLS / 自动升级（常用 587）</option><option value="true">SSL/TLS（常用 465）</option></select>
        <button className="pixel-button primary" type="submit">保存邮件配置</button>
      </form>
    </section>
    <section className="inventory-panel hero"><h2>生效状态</h2><p>当前页面负责安全保存 SMTP 配置。只有 NextAuth 邮箱登录和邮件发送服务切换到读取此配置后，才会真正用于发信；保存成功本身不代表 SMTP 连通。</p></section>
  </main>
}