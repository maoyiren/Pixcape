import { redirect } from 'next/navigation'

/** Keep the legacy bookmark working while routing to the canonical wardrobe entry. */
export default function DressUpPage() {
  redirect('/wardrobe')
}
