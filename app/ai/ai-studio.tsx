'use client'

import { useRouter } from 'next/navigation'
import AiSkinStudio from '../../src/AiSkinStudio'

export default function AiStudio() {
  const router = useRouter()

  return (
    <div data-studio-mode="ai">
      <AiSkinStudio onBack={() => router.push('/workbench')} />
    </div>
  )
}
