import type { Field, JsonValue, LinkValue } from './fields.js'
import type { Section, SectionValues } from './define.js'

/**
 * Helpers shared by the server and the editor for working with values.
 */

const isObject = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Brings a stored value in line with the current field definition, so a
 * schema change (a new list item key, a removed select option) never breaks
 * rendering. Values of the wrong shape fall back to the field's default.
 */
export function normalize(field: Field, value: unknown): JsonValue {
  if (value === undefined) {
    if (field.type === 'group') return defaultsOf(field.fields)
    return field.default
  }

  switch (field.type) {
    case 'text':
    case 'url':
    case 'icon':
      return typeof value === 'string' ? value : field.default
    case 'select':
      return field.options.some((option) => option.value === value)
        ? (value as string)
        : field.default
    case 'number':
      return typeof value === 'number' || value === null ? value : field.default
    case 'boolean':
      return typeof value === 'boolean' ? value : field.default
    case 'image':
    case 'file':
      return typeof value === 'string' || value === null ? value : field.default
    case 'link':
      return isObject(value)
        ? { label: String(value.label ?? ''), url: String(value.url ?? '') }
        : field.default
    case 'group':
      return normalizeFields(field.fields, isObject(value) ? value : {})
    case 'list':
      return Array.isArray(value)
        ? value.map((item) => normalizeFields(field.item, isObject(item) ? item : {}))
        : field.default
    case 'custom':
      return value as JsonValue
  }
}

/** Normalizes every field of an object; missing keys get their defaults */
export function normalizeFields(
  fields: Record<string, Field>,
  values: Record<string, unknown>
): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, normalize(field, values[key])])
  )
}

/** Default values for a set of fields (e.g. a new list item or document) */
export function defaultsOf(fields: Record<string, Field>): Record<string, JsonValue> {
  return normalizeFields(fields, {})
}

/**
 * A section's values: code defaults, overridden by whichever fields have
 * been edited (`stored` only holds edited fields).
 */
export function resolveSection<S extends Section>(
  section: S,
  stored: Record<string, unknown> = {}
): SectionValues<S> {
  return normalizeFields(section.fields, stored) as SectionValues<S>
}

/** Media key a URL points at, if it's under the media base URL ("/media/") */
export function mediaKeyFromUrl(url: string, baseUrl: string) {
  return url.startsWith(baseUrl) ? url.slice(baseUrl.length) || null : null
}

export type CustomMediaKeys = (field: Field & { type: 'custom' }, value: unknown) => string[]

export type MediaScan = {
  /** Public base URL of media files; links and URLs under it count as references */
  baseUrl: string
  /** Media keys referenced by custom field types */
  custom?: CustomMediaKeys
}

/**
 * Media keys a value references (used to protect images and files from
 * deletion in the media library). Custom field types report their own.
 */
export function mediaKeysIn(field: Field, value: unknown, scan: MediaScan): string[] {
  if (value === null || value === undefined) return []

  switch (field.type) {
    case 'image':
    case 'file':
      return typeof value === 'string' ? [value] : []
    case 'link': {
      const key = mediaKeyFromUrl((value as LinkValue).url ?? '', scan.baseUrl)
      return key ? [key] : []
    }
    case 'url': {
      const key = typeof value === 'string' ? mediaKeyFromUrl(value, scan.baseUrl) : null
      return key ? [key] : []
    }
    case 'group':
      return mediaKeysInFields(field.fields, value as Record<string, unknown>, scan)
    case 'list':
      return Array.isArray(value)
        ? value.flatMap((item) => mediaKeysInFields(field.item, item, scan))
        : []
    case 'custom':
      return scan.custom ? scan.custom(field, value) : []
    default:
      return []
  }
}

export function mediaKeysInFields(
  fields: Record<string, Field>,
  values: Record<string, unknown>,
  scan: MediaScan
): string[] {
  if (!isObject(values)) return []
  return Object.entries(fields).flatMap(([key, field]) => mediaKeysIn(field, values[key], scan))
}
