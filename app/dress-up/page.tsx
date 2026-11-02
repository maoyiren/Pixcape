import { redirect } from 'next/navigation'

export const metadata = {
  title: '衣服选装 | CDPC',
  description: '统一进入 CDPC 衣橱，管理皮肤、披肩、外套与披风搭配。',
}

/** Keep the legacy URL working while routing everyone to the canonical wardrobe. */
export default function LegacyDressUpPage() {
  redirect('/wardrobe')
}
