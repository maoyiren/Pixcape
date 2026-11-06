import { redirect } from 'next/navigation'

export const metadata = { title: 'Studio 角色换装 | CDPC' }

// Legacy workbench deep link; the canonical outfit workspace is /studio.
export default function WorkbenchDressCompatibilityRoute() {
  redirect('/studio')
}
