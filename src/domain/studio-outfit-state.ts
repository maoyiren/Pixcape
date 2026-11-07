export const STUDIO_POSES = ['idle', 'wave', 'walk', 'fly'] as const
export type StudioPose = typeof STUDIO_POSES[number]

export type StudioWorkspaceState = {
  projectId: string | null
  activeTool: 'WARDROBE' | 'PIXEL_EDITOR' | 'AI_GENERATOR'
  activeAssetId: string | null
  activeOutfitId: string | null
}

/** Legacy outfit snapshots may omit pose; normalize them to the stable idle state. */
export function normalizeStudioPose(value: unknown): StudioPose {
  return typeof value === 'string' && (STUDIO_POSES as readonly string[]).includes(value)
    ? value as StudioPose
    : 'idle'
}

/** Keep the current asset selected when saving an outfit without a separately uploaded skin. */
export function buildStudioWorkspaceState(current: StudioWorkspaceState, outfitId: string, skinAssetId: string | null): StudioWorkspaceState {
  return {
    projectId: current.projectId,
    activeTool: 'WARDROBE',
    activeAssetId: skinAssetId ?? current.activeAssetId,
    activeOutfitId: outfitId,
  }
}
