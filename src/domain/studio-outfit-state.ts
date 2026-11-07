export const STUDIO_POSES = ['idle', 'wave', 'walk', 'fly'] as const
export type StudioPose = typeof STUDIO_POSES[number]

/** Legacy outfit snapshots may omit pose; normalize them to the stable idle state. */
export function normalizeStudioPose(value: unknown): StudioPose {
  return typeof value === 'string' && (STUDIO_POSES as readonly string[]).includes(value)
    ? value as StudioPose
    : 'idle'
}
