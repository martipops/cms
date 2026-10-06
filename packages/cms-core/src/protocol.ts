import type { JsonValue } from './fields.js'
import type { Collection, Document, Section } from './define.js'

/**
 * What travels between the server and the editor: page props and the
 * commit/history endpoints.
 */

/** A page's (or site-wide scope's) content, as sent in Inertia props */
export type PageProps = {
  name: string
  /** Resolved values per section: code defaults with edits applied */
  values: Record<string, Record<string, JsonValue>>
  /** Section definitions, only sent to people who can edit */
  schema?: Record<string, Section>
}

/** A collection definition as sent to the editor (without its seed data) */
export type CollectionSchema = Omit<Collection, 'initial'>

/** A collection's items, as sent in Inertia props */
export type CollectionProps<Values = Record<string, JsonValue>> = {
  name: string
  /** Visible items; editors also get hidden ones (`hidden: true`) */
  items: Document<Values>[]
  /** Only sent to people who can edit */
  schema?: CollectionSchema
}

/**
 * One change in a commit. A commit applies all of its operations in a
 * single transaction, or none of them.
 */
export type CommitOp =
  /** Sets section fields; fields in `reset` go back to their code defaults */
  | {
      type: 'section.save'
      page: string
      section: string
      changes: Record<string, JsonValue>
      reset?: string[]
    }
  /** `ref` lets later ops in the same commit refer to the new item */
  | { type: 'doc.create'; collection: string; ref: string; data: Record<string, JsonValue> }
  /** `data` holds only the fields that changed */
  | {
      type: 'doc.update'
      collection: string
      id: number
      data?: Record<string, JsonValue>
      hidden?: boolean
    }
  | { type: 'doc.delete'; collection: string; id: number }
  /** Every item id in the new order. New items can be listed by their `ref` */
  | { type: 'doc.reorder'; collection: string; ids: (number | string)[] }

export type CommitError = {
  /** Index of the failing op */
  op: number
  /** Field path within the op's data, e.g. "hours.2.opens" ("" for the op itself) */
  path: string
  message: string
}

export type CommitResponse = {
  /** Ids given to items created in this commit, by `ref` */
  created: Record<string, { id: number; slug: string | null }>
}

/** What a history entry targets */
export type HistoryTarget = { section: string; page: string } | { collection: string; id: number }

export type Revision = {
  id: number
  action: 'save' | 'create' | 'delete'
  /**
   * Snapshot after the change. Sections store only edited fields;
   * documents store all their data. `null` for a delete.
   */
  data: Record<string, JsonValue> | null
  hidden: boolean | null
  user: string | null
  createdAt: string
}
