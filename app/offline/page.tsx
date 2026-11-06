import Link from 'next/link'

export const metadata = {
  title: '离线模式',
  description: 'CDPC 当前无法连接网络。',
}

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
      <div aria-hidden="true" className="mb-5 text-6xl">▦</div>
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">CDPC Offline</p>
      <h1 className="mb-3 text-3xl font-bold">当前处于离线状态</h1>
      <p className="mb-8 max-w-md text-slate-500">页面暂时无法连接服务器。你可以重新尝试连接；网络恢复后，登录、云端衣橱和保存功能会继续正常工作。</p>
      <Link href="/" className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700">重新连接</Link>
    </main>
  )
}
