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
import { getStudioShoeUvRegions } from '../domain/studio-uv-layout.ts'

type SkinLeg = Object3D & { outerLayer: Object3D }
type SkinParts = Object3D & { leftLeg: SkinLeg; rightLeg: SkinLeg }

function setShoeUv(geometry: BoxGeometry, region: ReturnType<typeof getStudioShoeUvRegions>[number], textureSize: 64 | 128) {
  const face = (rect: { x: number; y: number; width: number; height: number }) => [
    [rect.x / textureSize, 1 - (rect.y + rect.height) / textureSize],
    [(rect.x + rect.width) / textureSize, 1 - (rect.y + rect.height) / textureSize],
    [(rect.x + rect.width) / textureSize, 1 - rect.y / textureSize],
    [rect.x / textureSize, 1 - rect.y / textureSize],
  ]
  const top = face(region.faces.top)
  const bottom = face(region.faces.bottom)
  const left = face(region.faces.left)
  const right = face(region.faces.right)
  const front = face(region.faces.front)
  const back = face(region.faces.back)
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

/** Build one standalone shoe box with UVs constrained to a single leg atlas island. */
export function createStudioShoeGeometry(
  region: ReturnType<typeof getStudioShoeUvRegions>[number],
  textureSize: 64 | 128,
): BoxGeometry {
  const geometry = new BoxGeometry(4.75, 4.75, 4.75)
  setShoeUv(geometry, region, textureSize)
  return geometry
}

/**
 * Adds two independent boot meshes to the animated left/right leg pivots.
 * Each mesh samples only the lower four-unit shoe surfaces from its corresponding
 * Minecraft outer-leg atlas; it does not reuse the full-leg outer-layer mesh.
 */
export function attachStudioShoeGeometry(
  skinObject: unknown,
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
    const geometry = createStudioShoeGeometry(region, textureSize)
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
