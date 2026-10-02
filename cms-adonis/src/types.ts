import type { HttpContext } from '@adonisjs/core/http'
import type { SchemaTypes } from '@vinejs/vine/types'
import type { Collection, CustomField, JsonValue, Page } from '@martipops/cms-core'

/**
 * A site-specific field type, used with `f.custom(name, …)` in schemas. The
 * editor needs a component registered under the same name.
 */
export type FieldTypeDefinition = {
  name: string
  /** VineJS schema that validates (and may clean up) a value */
  validator: (field: CustomField) => SchemaTypes
  /** Media keys a value references, so they can't be deleted */
  mediaKeys?: (value: unknown, field: CustomField) => string[]
}

export type CmsUser = { id: number | string; name: string | null }

export type CmsConfig = {
  /** Pages and site-wide scopes (e.g. "site" for header/footer) */
  pages: Page<any>[]
  collections: Collection<any>[]
  fieldTypes: FieldTypeDefinition[]
  /** Whether the current request may edit content */
  authorize: (ctx: HttpContext) => boolean | Promise<boolean>
  /** The signed-in user, recorded on revisions */
  user: (ctx: HttpContext) => CmsUser | null
  /** Whether a media library file exists (validates image and file fields) */
  mediaExists: (key: string, folder: string) => Promise<boolean>
}

export type CmsConfigInput = Partial<Pick<CmsConfig, 'pages' | 'collections' | 'fieldTypes'>> &
  Pick<CmsConfig, 'authorize' | 'mediaExists'> &
  Partial<Pick<CmsConfig, 'user'>>

export type StoredDocument = {
  id: number
  collection: string
  slug: string | null
  data: Record<string, JsonValue>
  sortOrder: number
  hidden: boolean
}
