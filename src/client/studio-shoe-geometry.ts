import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  SRGBColorSpace,
  type Object3D,
} from 'three'
import { getStudioShoeUvRegions } from '@/src/domain/studio-uv-layout'

type SkinLeg = Object3D & { outerLayer: Object3D }
type SkinParts = Object3D & { leftLeg: SkinLeg; rightLeg: SkinLeg }

function setShoeUv(geometry: BoxGeometry, region: ReturnType<typeof getStudioShoeUvRegions>[number], textureSize: 64 | 128) {
  const { u, v, width, height, depth } = region
  const face = (x1: number, y1: number, x2: number, y2: number) => [
    [x1 / textureSize, 1 - y2 / textureSize],
    [x2 / textureSize, 1 - y2 / textureSize],
    [x2 / textureSize, 1 - y1 / textureSize],
    [x1 / textureSize, 1 - y1 / textureSize],
  ]
  const top = face(u + depth, v, u + width + depth, v + depth)
  const bottom = face(u + width + depth, v, u + width * 2 + depth, v + depth)
  const left = face(u, v + depth, u + depth, v + depth + height)
  const right = face(u + width + depth, v + depth, u + width + depth * 2, v + height + depth)
  const front = face(u + depth, v + depth, u + width + depth, v + depth + height)
  const back = face(u + width + depth * 2, v + depth, u + width * 2 + depth * 2, v + height + depth)
  const uvFaces = [
    [right[3], right[2], right[0], right[1]],
    [left[3], left[2], left[0], left[1]],
    [top[3], top[2], top[0], top[1]],
    [bottom[0], bottom[1], bottom[3], bottom[2]],
    [front[3], front[2], front[0], front[1]],
    [back[3], back[2], back[0], back[1]],
  ]
  const attribute = geometry.getAttribute('uv')
  let index = 0
  for (const vertices of uvFaces) {
    for (const [x, y] of vertices) attribute.setXY(index++, x, y)
  }
  attribute.needsUpdate = true
}

/**
 * Adds two independent boot meshes to the animated left/right leg pivots.
 * Each mesh samples only the lower 4×4×4 UV island of its corresponding
 * Minecraft outer-leg atlas; it does not reuse the full-leg outer-layer mesh.
 */
export function attachStudioShoeGeometry(
  skinObject: Object3D,
  image: HTMLImageElement,
  textureSize: 64 | 128,
): () => void {
  if (image.naturalWidth !== textureSize || image.naturalHeight !== textureSize) {
    throw new Error('鞋子贴图尺寸必须与角色皮肤一致（64×64 或 128×128）。')
  }
  const skin = skinObject as SkinParts
  const texture = new CanvasTexture(image)
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true

  const material = new MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.001,
    side: DoubleSide,
  })
  const regions = getStudioShoeUvRegions(textureSize)
  const meshes: Mesh[] = []

  for (const region of regions) {
    const leg = region.side === 'left' ? skin.leftLeg : skin.rightLeg
    const pivot = leg.outerLayer.parent
    if (!pivot) {
      material.dispose()
      texture.dispose()
      throw new Error('角色腿部模型尚未初始化，无法安装独立鞋子几何。')
    }
    const geometry = new BoxGeometry(4.75, 4.75, 4.75)
    setShoeUv(geometry, region, textureSize)
    const shoe = new Mesh(geometry, material)
    shoe.name = `cdpc-shoe-${region.side}`
    shoe.position.set(0, -4, 0)
    shoe.renderOrder = 3
    pivot.add(shoe)
    meshes.push(shoe)
  }

  return () => {
    for (const shoe of meshes) {
      shoe.parent?.remove(shoe)
      shoe.geometry.dispose()
    }
    material.dispose()
    texture.dispose()
  }
}
