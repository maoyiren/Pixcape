import { redirect } from 'next/navigation'

export const metadata = { title: '3D 换装 | 创作工作台 | CDPC' }

// Keep the historical workbench URL as a compatibility alias; the canonical
// 3D studio owns the only live outfit editing state.
export default function WorkbenchDressPage() {
  redirect('/dress-up')
}
