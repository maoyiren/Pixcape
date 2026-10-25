import { redirect } from 'next/navigation'

/**
 * The standalone legacy dress-up page has been retired.
 * Wardrobe editing now enters through the shared studio/editor route.
 * Keep this redirect so existing bookmarks and links do not break.
 */
export default function DressUpPage() {
  redirect('/studio/?mode=wardrobe')
}
