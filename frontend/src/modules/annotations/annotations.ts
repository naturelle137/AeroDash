// Instructor-authored teaching notes anchored to result endpoints. They are advisory human
// content stored on this device only; nothing here reads, clears or alters system notifications.

export const ANNOTATION_ANCHORS = [
  { id: 'takeoff', label: 'Takeoff' },
  { id: 'zeroFuel', label: 'Zero fuel' },
  { id: 'fuelBurned', label: 'All usable fuel burned' },
  { id: 'takeoffDistance', label: 'Takeoff distance' },
  { id: 'landingDistance', label: 'Landing distance' },
] as const

export type AnnotationAnchor = (typeof ANNOTATION_ANCHORS)[number]['id']

export interface Annotation {
  id: string
  aircraftId: string
  anchor: AnnotationAnchor
  /** Self-declared and unauthenticated. */
  author: string
  text: string
  createdAt: string
  updatedAt: string
}

export const AUTHOR_MAX = 80
export const TEXT_MAX = 500
export const STORAGE_KEY = 'aerodash:annotations:v1'

export const anchorLabel = (anchor: AnnotationAnchor): string =>
  ANNOTATION_ANCHORS.find(a => a.id === anchor)?.label ?? anchor

export function validateDraft(author: string, text: string): string | null {
  if (!author.trim()) return 'Enter the author name.'
  if (author.trim().length > AUTHOR_MAX) return `Author name is limited to ${AUTHOR_MAX} characters.`
  if (!text.trim()) return 'Enter the note text.'
  if (text.trim().length > TEXT_MAX) return `Note text is limited to ${TEXT_MAX} characters.`
  return null
}

function isAnnotation(value: unknown): value is Annotation {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return ['id', 'aircraftId', 'author', 'text', 'createdAt', 'updatedAt'].every(k => typeof v[k] === 'string') &&
    ANNOTATION_ANCHORS.some(a => a.id === v.anchor) &&
    validateDraft(v.author as string, v.text as string) === null
}

/** Drops malformed entries; corrupt storage yields an empty list rather than an error. */
export function parseStored(raw: string | null): Annotation[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(isAnnotation) : []
  } catch {
    return []
  }
}
