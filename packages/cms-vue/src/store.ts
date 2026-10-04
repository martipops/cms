import { reactive } from 'vue'
import { router } from '@inertiajs/vue3'
import {
  defaultsOf,
  normalize,
  type CollectionProps,
  type CommitError,
  type CommitOp,
  type CommitResponse,
  type JsonValue,
  type PageProps,
  type Revision,
  type Section,
} from '@martipops/cms-core'
import { api, ApiError } from './http.js'
import { options } from './options.js'

/**
 * Edit-mode state. Pages and collections register their (saved) props
 * here; edits are kept as drafts on top of them so the page previews every
 * change live. Nothing reaches the server until `save()`, which sends all
 * drafts as one commit.
 */

type Values = Record<string, JsonValue>

type SectionDraft = { page: string; section: string; changes: Values; reset: string[] }

type CollectionDraft = {
  creates: { ref: string; data: Values }[]
  updates: Record<number, { data: Values; hidden?: boolean }>
  deletes: number[]
  /** Item keys (ids, or refs for new items) in their new order */
  order: (number | string)[] | null
}

/** A collection item with drafts applied */
export type Item = {
  /** Id, or a temporary ref for an unsaved new item */
  key: number | string
  id: number | null
  slug: string | null
  hidden: boolean
  data: Values
  isNew: boolean
  dirty: boolean
}

export type Panel =
  | { kind: 'section'; page: string; section: string }
  | { kind: 'collection'; collection: string; focus?: number | string }

export type HistoryTarget =
  | { kind: 'section'; page: string; section: string }
  | { kind: 'item'; collection: string; id: number }

const STORAGE_KEY = 'cms:edit-mode'
let refCounter = 0

export const editor = reactive({
  enabled: false,
  saving: false,
  pages: {} as Record<string, PageProps>,
  collections: {} as Record<string, CollectionProps>,
  sectionDrafts: {} as Record<string, SectionDraft>,
  collectionDrafts: {} as Record<string, CollectionDraft>,
  /** Server validation errors by target key, then field path */
  errors: {} as Record<string, Record<string, string>>,
  panel: null as Panel | null,
  history: null as HistoryTarget | null,
})

export const sectionKey = (page: string, section: string) => `section:${page}.${section}`
export const itemKey = (collection: string, key: number | string) => `item:${collection}:${key}`

/*
|--------------------------------------------------------------------------
| Registration
|--------------------------------------------------------------------------
*/

export function registerPage(props: PageProps) {
  editor.pages[props.name] = props
}

export function registerCollection(props: CollectionProps) {
  editor.collections[props.name] = props
}

/** Whether edit mode is on and the server sent this page's schema */
export function canEditPage(page: string) {
  return editor.enabled && Boolean(editor.pages[page]?.schema)
}

export function canEditCollection(collection: string) {
  return editor.enabled && Boolean(editor.collections[collection]?.schema)
}

/*
|--------------------------------------------------------------------------
| Sections
|--------------------------------------------------------------------------
*/

export function sectionSchema(page: string, section: string): Section | undefined {
  return editor.pages[page]?.schema?.[section]
}

/** A section's values with drafts applied */
export function sectionValues(page: string, section: string): Values {
  const saved = editor.pages[page]?.values[section] ?? {}
  const draft = editor.sectionDrafts[sectionKey(page, section)]
  if (!draft) return saved

  const schema = sectionSchema(page, section)
  const values = { ...saved, ...draft.changes }
  for (const key of draft.reset) {
    if (schema?.fields[key]) values[key] = normalize(schema.fields[key], undefined)
  }
  return values
}

function sectionDraft(page: string, section: string) {
  const key = sectionKey(page, section)
  editor.sectionDrafts[key] ??= { page, section, changes: {}, reset: [] }
  return editor.sectionDrafts[key]
}

function pruneSection(page: string, section: string) {
  const key = sectionKey(page, section)
  const draft = editor.sectionDrafts[key]
  if (draft && !Object.keys(draft.changes).length && !draft.reset.length) {
    delete editor.sectionDrafts[key]
  }
}

export function setSectionField(page: string, section: string, field: string, value: JsonValue) {
  const draft = sectionDraft(page, section)
  draft.reset = draft.reset.filter((key) => key !== field)
  const saved = editor.pages[page]?.values[section]?.[field]
  if (JSON.stringify(saved) === JSON.stringify(value)) delete draft.changes[field]
  else draft.changes[field] = value
  delete editor.errors[sectionKey(page, section)]?.[field]
  pruneSection(page, section)
}

/** Stages resetting fields (all by default) to their code defaults */
export function resetSection(page: string, section: string, fields?: string[]) {
  const schema = sectionSchema(page, section)
  if (!schema) return
  const draft = sectionDraft(page, section)
  for (const field of fields ?? Object.keys(schema.fields)) {
    delete draft.changes[field]
    if (!draft.reset.includes(field)) draft.reset.push(field)
  }
}

/** Stages a section revision: its edited fields, everything else reset */
export function restoreSection(page: string, section: string, snapshot: Values) {
  const schema = sectionSchema(page, section)
  if (!schema) return
  resetSection(page, section)
  for (const [field, value] of Object.entries(snapshot)) {
    if (schema.fields[field]) setSectionField(page, section, field, value)
  }
}

/*
|--------------------------------------------------------------------------
| Collections
|--------------------------------------------------------------------------
*/

function collectionDraft(collection: string) {
  editor.collectionDrafts[collection] ??= { creates: [], updates: {}, deletes: [], order: null }
  return editor.collectionDrafts[collection]
}

function pruneCollection(collection: string) {
  const draft = editor.collectionDrafts[collection]
  if (
    draft &&
    !draft.creates.length &&
    !Object.keys(draft.updates).length &&
    !draft.deletes.length &&
    !draft.order
  ) {
    delete editor.collectionDrafts[collection]
  }
}

/** Every item of a collection (hidden ones included) with drafts applied */
export function collectionItems(collection: string): Item[] {
  const props = editor.collections[collection]
  if (!props) return []
  const draft = editor.collectionDrafts[collection]

  const items: Item[] = props.items
    .filter((doc) => !draft?.deletes.includes(doc.id))
    .map((doc) => {
      const update = draft?.updates[doc.id]
      return {
        key: doc.id,
        id: doc.id,
        slug: doc.slug,
        hidden: update?.hidden ?? doc.hidden,
        data: update ? { ...doc.data, ...update.data } : doc.data,
        isNew: false,
        dirty: Boolean(update),
      }
    })

  for (const create of draft?.creates ?? []) {
    items.push({
      key: create.ref,
      id: null,
      slug: null,
      hidden: false,
      data: create.data,
      isNew: true,
      dirty: true,
    })
  }

  if (draft?.order) {
    const position = new Map(draft.order.map((key, index) => [key, index]))
    items.sort((a, b) => (position.get(a.key) ?? Infinity) - (position.get(b.key) ?? Infinity))
  }
  return items
}

export function setItemField(
  collection: string,
  key: number | string,
  field: string,
  value: JsonValue
) {
  const draft = collectionDraft(collection)
  delete editor.errors[itemKey(collection, key)]?.[field]

  if (typeof key === 'string') {
    const create = draft.creates.find((c) => c.ref === key)
    if (create) create.data = { ...create.data, [field]: value }
    return
  }

  const saved = editor.collections[collection]?.items.find((doc) => doc.id === key)
  const update = (draft.updates[key] ??= { data: {} })
  if (JSON.stringify(saved?.data[field]) === JSON.stringify(value)) delete update.data[field]
  else update.data[field] = value
  pruneUpdate(collection, key)
}

export function setItemHidden(collection: string, key: number | string, hidden: boolean) {
  if (typeof key === 'string') return
  const draft = collectionDraft(collection)
  const saved = editor.collections[collection]?.items.find((doc) => doc.id === key)
  const update = (draft.updates[key] ??= { data: {} })
  if (saved?.hidden === hidden) delete update.hidden
  else update.hidden = hidden
  pruneUpdate(collection, key)
}

function pruneUpdate(collection: string, id: number) {
  const draft = collectionDraft(collection)
  const update = draft.updates[id]
  if (update && !Object.keys(update.data).length && update.hidden === undefined) {
    delete draft.updates[id]
  }
  pruneCollection(collection)
}

/** Stages a new item with default values; returns its temporary key */
export function addItem(collection: string): string | null {
  const schema = editor.collections[collection]?.schema
  if (!schema) return null
  const ref = `new-${++refCounter}`
  const draft = collectionDraft(collection)
  draft.creates.push({ ref, data: defaultsOf(schema.fields) })
  if (draft.order) draft.order.push(ref)
  return ref
}

export function removeItem(collection: string, key: number | string) {
  const draft = collectionDraft(collection)
  if (typeof key === 'string') {
    draft.creates = draft.creates.filter((c) => c.ref !== key)
  } else {
    delete draft.updates[key]
    draft.deletes.push(key)
  }
  if (draft.order) draft.order = draft.order.filter((k) => k !== key)
  delete editor.errors[itemKey(collection, key)]
  pruneCollection(collection)
}

export function moveItem(collection: string, key: number | string, offset: -1 | 1) {
  const keys = collectionItems(collection).map((item) => item.key)
  const index = keys.indexOf(key)
  const target = index + offset
  if (index === -1 || target < 0 || target >= keys.length) return
  ;[keys[index], keys[target]] = [keys[target], keys[index]]

  const draft = collectionDraft(collection)
  const saved = editor.collections[collection]?.items.map((doc) => doc.id) ?? []
  draft.order = JSON.stringify(keys) === JSON.stringify(saved) ? null : keys
  pruneCollection(collection)
}

/** Stages an item revision's data (and visibility) */
export function restoreItem(collection: string, id: number, revision: Revision) {
  if (!revision.data) return
  for (const [field, value] of Object.entries(revision.data)) {
    setItemField(collection, id, field, value)
  }
  if (revision.hidden !== null) setItemHidden(collection, id, revision.hidden)
}

/*
|--------------------------------------------------------------------------
| Edit mode, saving
|--------------------------------------------------------------------------
*/

export function draftCount() {
  let count = 0
  for (const draft of Object.values(editor.sectionDrafts)) {
    count += Object.keys(draft.changes).length + draft.reset.length
  }
  for (const draft of Object.values(editor.collectionDrafts)) {
    count += draft.creates.length + Object.keys(draft.updates).length + draft.deletes.length
    if (draft.order) count += 1
  }
  return count
}

export function sectionDirty(page: string, section: string) {
  return sectionKey(page, section) in editor.sectionDrafts
}

export function collectionDirty(collection: string) {
  return collection in editor.collectionDrafts
}

export function discard() {
  editor.sectionDrafts = {}
  editor.collectionDrafts = {}
  editor.errors = {}
}

export function openPanel(panel: Panel) {
  editor.panel = panel
}

export function setEnabled(enabled: boolean) {
  editor.enabled = enabled
  if (!enabled) editor.panel = null
  try {
    sessionStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {}
}

export function restoreEnabled() {
  try {
    if (new URLSearchParams(window.location.search).has('edit')) return setEnabled(true)
    editor.enabled = sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {}
}

/** Builds the commit, remembering which draft each op came from */
function buildOps() {
  const ops: CommitOp[] = []
  const targets: string[] = []

  for (const draft of Object.values(editor.sectionDrafts)) {
    ops.push({
      type: 'section.save',
      page: draft.page,
      section: draft.section,
      changes: draft.changes,
      reset: draft.reset,
    })
    targets.push(sectionKey(draft.page, draft.section))
  }

  for (const [collection, draft] of Object.entries(editor.collectionDrafts)) {
    for (const create of draft.creates) {
      ops.push({ type: 'doc.create', collection, ref: create.ref, data: create.data })
      targets.push(itemKey(collection, create.ref))
    }
    for (const [id, update] of Object.entries(draft.updates)) {
      ops.push({
        type: 'doc.update',
        collection,
        id: Number(id),
        ...(Object.keys(update.data).length ? { data: update.data } : {}),
        ...(update.hidden !== undefined ? { hidden: update.hidden } : {}),
      })
      targets.push(itemKey(collection, Number(id)))
    }
    for (const id of draft.deletes) {
      ops.push({ type: 'doc.delete', collection, id })
      targets.push(itemKey(collection, id))
    }
    if (draft.order || draft.creates.length) {
      // New items go last unless they were moved
      const order = draft.order ?? collectionItems(collection).map((item) => item.key)
      ops.push({ type: 'doc.reorder', collection, ids: order })
      targets.push(`collection:${collection}`)
    }
  }

  return { ops, targets }
}

/**
 * Saves every draft in one commit, then reloads the page props so what's on
 * screen is what's stored. On validation errors nothing is saved; the
 * errors are kept for the forms to show.
 */
export async function save() {
  const { ops, targets } = buildOps()
  if (!ops.length) return

  editor.saving = true
  editor.errors = {}
  try {
    await api<CommitResponse>(`${options.endpoint}/commit`, { method: 'POST', body: { ops } })
    discard()
    await new Promise<void>((resolve) => router.reload({ onFinish: () => resolve() }))
  } catch (error) {
    if (error instanceof ApiError && Array.isArray(error.body.errors)) {
      for (const { op, path, message } of error.body.errors as CommitError[]) {
        const target = targets[op]
        if (target) (editor.errors[target] ??= {})[path] = message
      }
    }
    throw error
  } finally {
    editor.saving = false
  }
}

export async function loadHistory(target: HistoryTarget) {
  const params = new URLSearchParams(
    target.kind === 'section'
      ? { page: target.page, section: target.section }
      : { collection: target.collection, id: String(target.id) }
  )
  const { data } = await api<{ data: Revision[] }>(`${options.endpoint}/history?${params}`)
  return data
}
