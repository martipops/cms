import type { Field, JsonValue, ValuesOf } from './fields.js'

/**
 * Sections, pages and collections: the units of editable content.
 *
 * - A **section** is one block of a page (a hero, a "Get involved" band). It
 *   is edited as one form in the slide-out panel. Defaults live in code;
 *   only edited fields are stored.
 * - A **page** (or site-wide scope like "site" for header/footer) is a named
 *   set of sections.
 * - A **collection** is a list of structured records (locations, specials)
 *   stored as documents, edited as a list of collapsible forms.
 */

export type Section<Fields extends Record<string, Field> = Record<string, Field>> = {
  label: string
  description?: string
  fields: Fields
}

export type Page<Sections extends Record<string, Section> = Record<string, Section>> = {
  name: string
  sections: Sections
}

export type CollectionPermissions = {
  /** Staff can add items */
  create: boolean
  /** Staff can delete items */
  delete: boolean
  /** Staff can change the order items are shown in */
  reorder: boolean
  /** Staff can hide items without deleting them */
  hide: boolean
}

export type Collection<Fields extends Record<string, Field> = Record<string, Field>> = {
  name: string
  /** Singular, e.g. "Location" */
  label: string
  /** Plural, e.g. "Locations" */
  labelPlural: string
  fields: Fields
  /** Field used as each item's title in lists */
  titleField: keyof Fields & string
  /**
   * Items get a URL-safe slug generated from this field when created. Slugs
   * never change afterwards, since they're usually part of page URLs.
   */
  slugFrom?: keyof Fields & string
  allow: CollectionPermissions
  /** Inserted once, the first time the collection is used */
  initial: (ValuesOf<Fields> & { slug?: string })[]
}

/** Values of a section */
export type SectionValues<S extends Section> = ValuesOf<S['fields']>

/** Values of a collection item, without its document metadata */
export type ItemValues<C extends Collection<any>> = ValuesOf<C['fields']>

/** A collection item as the server returns it */
export type Document<Values = Record<string, JsonValue>> = {
  id: number
  slug: string | null
  hidden: boolean
  sortOrder: number
  data: Values
}

/** "orderOnlineUrl" → "Order online url" */
export function humanize(key: string) {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Fills in missing labels from field keys, recursively */
function labelled<Fields extends Record<string, Field>>(fields: Fields): Fields {
  for (const [key, field] of Object.entries(fields)) {
    if (!field.label) field.label = humanize(key)
    if (field.type === 'group') labelled(field.fields)
    if (field.type === 'list') labelled(field.item)
  }
  return fields
}

function assertKeys(where: string, fields: Record<string, Field>) {
  for (const key of Object.keys(fields)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Field key "${where}.${key}" must be a plain identifier`)
    }
  }
}

export function section<Fields extends Record<string, Field>>(
  label: string,
  fields: Fields,
  options: { description?: string } = {}
): Section<Fields> {
  return { label, ...options, fields: labelled(fields) }
}

export function definePage<Sections extends Record<string, Section>>(
  name: string,
  sections: Sections
): Page<Sections> {
  for (const [key, value] of Object.entries(sections)) {
    assertKeys(`${name}.${key}`, value.fields)
  }
  return { name, sections }
}

export function defineCollection<Fields extends Record<string, Field>>(
  name: string,
  options: {
    label: string
    labelPlural?: string
    fields: Fields
    titleField: keyof Fields & string
    slugFrom?: keyof Fields & string
    allow?: Partial<CollectionPermissions>
    initial?: Collection<Fields>['initial']
  }
): Collection<Fields> {
  assertKeys(name, options.fields)
  return {
    name,
    label: options.label,
    labelPlural: options.labelPlural ?? `${options.label}s`,
    fields: labelled(options.fields),
    titleField: options.titleField,
    slugFrom: options.slugFrom,
    allow: { create: true, delete: true, reorder: true, hide: true, ...options.allow },
    initial: options.initial ?? [],
  }
}

/** "Holiday Manor!" → "holiday-manor" */
export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
