import DressUpStudio from './dress-up-studio'

export const metadata = {
  title: '衣服选装',
  description: '选择披肩、外套和披风等已接入素材，在真实 3D 角色中预览搭配。',
}

/** Keep /dress-up as a real wardrobe route instead of redirecting away from the studio. */
export default function DressUpPage() {
  return <DressUpStudio />
}
