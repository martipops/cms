import vine, { errors as vineErrors } from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  defaultsOf,
  mediaKeysInFields,
  normalizeFields,
  resolveSection,
  slugify,
  type Collection,
  type CollectionProps,
  type CollectionSchema,
  type CommitError,
  type CommitOp,
  type CommitResponse,
  type CustomMediaKeys,
  type Document,
  type Field,
  type HistoryTarget,
  type JsonValue,
  type Page,
  type PageProps,
  type Revision,
  type Section,
} from '@martipops/cms-core'
import { SchemaCompiler } from './validation.js'
import type { CmsConfig, CmsUser, StoredDocument } from './types.js'

export const TABLES = {
  sections: 'cms_sections',
  documents: 'cms_documents',
  revisions: 'cms_revisions',
  seeds: 'cms_seeds',
}

/** Thrown by `commit()` when any op is invalid; nothing is saved */
export class CommitValidationError extends Exception {
  static status = 422
  static code = 'E_CMS_VALIDATION'

  constructor(public errors: CommitError[]) {
    super(errors[0]?.message ?? 'Invalid content')
  }
}

type SectionValues = Record<string, Record<string, JsonValue>>

const now = () => new Date().toISOString()
const parse = (json: string | null) => (json === null ? null : JSON.parse(json))

/**
 * Reads and writes editable content.
 *
 * Sections store only edited fields (`cms_sections`); defaults come from the
 * schemas in code. Collection items are JSON documents (`cms_documents`).
 * Every change is appended to `cms_revisions`.
 */
export class Cms {
  readonly pages: Map<string, Page>
  readonly collections: Map<string, Collection>
  readonly compiler: SchemaCompiler

  #sections = new Map<string, SectionValues>()
  #documents = new Map<string, StoredDocument[]>()
  #seeded = new Set<string>()
  #canEdit = new WeakMap<HttpContext, Promise<boolean>>()

  constructor(readonly config: CmsConfig) {
    this.pages = new Map(config.pages.map((page) => [page.name, page]))
    this.collections = new Map(config.collections.map((c) => [c.name, c]))
    this.compiler = new SchemaCompiler(config)

    // Fail at boot rather than on first save
    for (const page of this.pages.values()) {
      for (const section of Object.values(page.sections)) this.compiler.fields(section.fields)
    }
    for (const collection of this.collections.values()) this.compiler.fields(collection.fields)
  }

  /** Clears cached content (tests roll back transactions underneath the cache) */
  clearCache() {
    this.#sections.clear()
    this.#documents.clear()
    this.#seeded.clear()
  }

  page(name: string): Page {
    const page = this.pages.get(name)
    if (!page) throw new Exception(`Unknown CMS page "${name}"`, { status: 404 })
    return page
  }

  collection(name: string): Collection {
    const collection = this.collections.get(name)
    if (!collection) throw new Exception(`Unknown CMS collection "${name}"`, { status: 404 })
    return collection
  }

  /** Whether this request may edit content (memoized per request) */
  canEdit(ctx: HttpContext): Promise<boolean> {
    let result = this.#canEdit.get(ctx)
    if (!result) {
      result = Promise.resolve(this.config.authorize(ctx))
      this.#canEdit.set(ctx, result)
    }
    return result
  }

  /*
  |--------------------------------------------------------------------------
  | Reading
  |--------------------------------------------------------------------------
  */

  /** A page's section values: code defaults with saved edits applied */
  async sections(name: string): Promise<SectionValues> {
    const cached = this.#sections.get(name)
    if (cached) return cached

    const page = this.page(name)
    const rows = await db.from(TABLES.sections).where('page', name)
    const stored = new Map(rows.map((row) => [row.section, parse(row.data)]))

    const values = Object.fromEntries(
      Object.entries(page.sections).map(([key, section]) => [
        key,
        resolveSection(section, stored.get(key) ?? {}),
      ])
    )
    this.#sections.set(name, values)
    return values
  }

  /** Page props for Inertia. Editors also get the section definitions */
  async pageProps(name: string, ctx: HttpContext): Promise<PageProps> {
    const editable = await this.canEdit(ctx)
    return {
      name,
      values: await this.sections(name),
      ...(editable ? { schema: this.page(name).sections } : {}),
    }
  }

  /** A collection's items in display order; hidden ones only on request */
  async items<Values = Record<string, JsonValue>>(
    name: string,
    options: { includeHidden?: boolean } = {}
  ): Promise<Document<Values>[]> {
    const all = await this.#allDocuments(name)
    return all
      .filter((doc) => options.includeHidden || !doc.hidden)
      .map((doc) => this.#toDocument(doc) as Document<Values>)
  }

  /** A visible item by slug */
  async find<Values = Record<string, JsonValue>>(
    name: string,
    slug: string
  ): Promise<Document<Values> | null> {
    const docs = await this.#allDocuments(name)
    const doc = docs.find((d) => d.slug === slug && !d.hidden)
    return doc ? (this.#toDocument(doc) as Document<Values>) : null
  }

  async findOrFail<Values = Record<string, JsonValue>>(name: string, slug: string) {
    const doc = await this.find<Values>(name, slug)
    if (!doc) throw new Exception(`${this.collection(name).label} not found`, { status: 404 })
    return doc
  }

  /** Collection props for Inertia. Editors also get hidden items and the schema */
  async collectionProps<Values = Record<string, JsonValue>>(
    name: string,
    ctx: HttpContext
  ): Promise<CollectionProps<Values>> {
    const editable = await this.canEdit(ctx)
    const schema: Partial<Collection> = { ...this.collection(name) }
    delete schema.initial
    return {
      name,
      items: await this.items<Values>(name, { includeHidden: editable }),
      ...(editable ? { schema: schema as CollectionSchema } : {}),
    }
  }

  #toDocument(doc: StoredDocument): Document {
    return {
      id: doc.id,
      slug: doc.slug,
      hidden: doc.hidden,
      sortOrder: doc.sortOrder,
      data: normalizeFields(this.collection(doc.collection).fields, doc.data),
    }
  }

  async #allDocuments(name: string): Promise<StoredDocument[]> {
    const cached = this.#documents.get(name)
    if (cached) return cached

    this.collection(name)
    await this.#ensureSeeded(name)
    const rows = await db
      .from(TABLES.documents)
      .where('collection', name)
      .orderBy('sort_order')
      .orderBy('id')

    const docs = rows.map((row) => ({
      id: row.id,
      collection: row.collection,
      slug: row.slug,
      data: parse(row.data),
      sortOrder: row.sort_order,
      hidden: Boolean(row.hidden),
    }))
    this.#documents.set(name, docs)
    return docs
  }

  /**
   * Inserts a collection's `initial` items the first time it's used. Never
   * runs again, so items staff delete stay deleted.
   */
  async #ensureSeeded(name: string) {
    if (this.#seeded.has(name)) return
    const collection = this.collection(name)

    await db.transaction(async (trx) => {
      const seeded = await trx.from(TABLES.seeds).where('collection', name).first()
      if (seeded) return

      await trx.table(TABLES.seeds).insert({ collection: name, seeded_at: now() })
      for (const [index, { slug, ...item }] of collection.initial.entries()) {
        const data = normalizeFields(collection.fields, item)
        await trx.table(TABLES.documents).insert({
          collection: name,
          slug: slug ?? (await this.#uniqueSlug(trx, collection, data)),
          data: JSON.stringify(data),
          sort_order: index,
          hidden: false,
          created_at: now(),
          updated_at: now(),
        })
      }
    })
    this.#seeded.add(name)
  }

  /*
  |--------------------------------------------------------------------------
  | Writing
  |--------------------------------------------------------------------------
  */

  /**
   * Applies a batch of changes in one transaction. If any op is invalid,
   * nothing is saved and every problem is reported.
   */
  async commit(ops: CommitOp[], user: CmsUser | null): Promise<CommitResponse> {
    const errors: CommitError[] = []
    const created: CommitResponse['created'] = {}
    const touchedPages = new Set<string>()
    const touchedCollections = new Set<string>()

    for (const op of ops) {
      if (op.type === 'section.save') this.page(op.page)
      else {
        await this.#ensureSeeded(op.collection)
        touchedCollections.add(op.collection)
      }
    }

    const fail = (op: number, path: string, message: string) => {
      errors.push({ op, path, message })
    }

    await db
      .transaction(async (trx) => {
        for (const [index, op] of ops.entries()) {
          switch (op.type) {
            case 'section.save':
              touchedPages.add(op.page)
              await this.#saveSection(trx, op, user, (path, message) => fail(index, path, message))
              break
            case 'doc.create': {
              const result = await this.#createDocument(trx, op, user, (path, message) =>
                fail(index, path, message)
              )
              if (result) created[op.ref] = result
              break
            }
            case 'doc.update':
              await this.#updateDocument(trx, op, user, (path, message) =>
                fail(index, path, message)
              )
              break
            case 'doc.delete':
              await this.#deleteDocument(trx, op, user, (path, message) =>
                fail(index, path, message)
              )
              break
            case 'doc.reorder':
              await this.#reorder(trx, op, created, (path, message) => fail(index, path, message))
              break
            default:
              fail(index, '', 'Unknown operation')
          }
        }
        if (errors.length) throw new CommitValidationError(errors)
      })
      .finally(() => {
        for (const page of touchedPages) this.#sections.delete(page)
        for (const collection of touchedCollections) this.#documents.delete(collection)
      })

    return { created }
  }

  async #saveSection(
    trx: TransactionClientContract,
    op: Extract<CommitOp, { type: 'section.save' }>,
    user: CmsUser | null,
    fail: (path: string, message: string) => void
  ) {
    const section: Section | undefined = this.page(op.page).sections[op.section]
    if (!section) return fail('', `Unknown section "${op.page}.${op.section}"`)

    const changes = op.changes ?? {}
    const reset = op.reset ?? []
    const toValidate: Record<string, Field> = {}
    for (const key of [...Object.keys(changes), ...reset]) {
      if (!section.fields[key]) return fail(key, `Unknown field "${key}"`)
    }
    for (const key of Object.keys(changes)) toValidate[key] = section.fields[key]

    const validated = await this.#validate(toValidate, changes, fail)
    if (!validated) return

    const row = await trx
      .from(TABLES.sections)
      .where({ page: op.page, section: op.section })
      .first()
    const data: Record<string, JsonValue> = { ...(parse(row?.data ?? null) ?? {}) }
    for (const key of reset) delete data[key]
    for (const key of Object.keys(changes)) data[key] = validated[key]

    const json = JSON.stringify(data)
    if (!Object.keys(data).length) {
      await trx.from(TABLES.sections).where({ page: op.page, section: op.section }).delete()
    } else if (row) {
      await trx
        .from(TABLES.sections)
        .where('id', row.id)
        .update({ data: json, updated_by: user?.id ?? null, updated_at: now() })
    } else {
      await trx.table(TABLES.sections).insert({
        page: op.page,
        section: op.section,
        data: json,
        updated_by: user?.id ?? null,
        created_at: now(),
        updated_at: now(),
      })
    }

    await this.#revision(trx, user, {
      kind: 'section',
      target: `${op.page}.${op.section}`,
      action: 'save',
      data: json,
      hidden: null,
    })
  }

  async #createDocument(
    trx: TransactionClientContract,
    op: Extract<CommitOp, { type: 'doc.create' }>,
    user: CmsUser | null,
    fail: (path: string, message: string) => void
  ) {
    const collection = this.collection(op.collection)
    if (!collection.allow.create) return fail('', `${collection.labelPlural} can't be added`)

    const data = await this.#validate(
      collection.fields,
      { ...defaultsOf(collection.fields), ...op.data },
      fail
    )
    if (!data) return

    const last = await trx
      .from(TABLES.documents)
      .where('collection', collection.name)
      .max('sort_order as max')
      .first()
    const slug = await this.#uniqueSlug(trx, collection, data)
    const json = JSON.stringify(data)

    const [inserted] = await trx
      .table(TABLES.documents)
      .insert({
        collection: collection.name,
        slug,
        data: json,
        sort_order: (last?.max ?? -1) + 1,
        hidden: false,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
        created_at: now(),
        updated_at: now(),
      })
      .returning('id')
    const id = typeof inserted === 'object' ? inserted.id : inserted

    await this.#revision(trx, user, {
      kind: 'document',
      target: `${collection.name}:${id}`,
      action: 'create',
      data: json,
      hidden: false,
    })
    return { id: Number(id), slug }
  }

  async #updateDocument(
    trx: TransactionClientContract,
    op: Extract<CommitOp, { type: 'doc.update' }>,
    user: CmsUser | null,
    fail: (path: string, message: string) => void
  ) {
    const collection = this.collection(op.collection)
    const row = await trx
      .from(TABLES.documents)
      .where({ collection: collection.name, id: op.id })
      .first()
    if (!row) return fail('', `This ${collection.label.toLowerCase()} no longer exists`)

    let data = parse(row.data)
    if (op.data) {
      for (const key of Object.keys(op.data)) {
        if (!collection.fields[key]) return fail(key, `Unknown field "${key}"`)
      }
      const validated = await this.#validate(
        collection.fields,
        { ...normalizeFields(collection.fields, data), ...op.data },
        fail
      )
      if (!validated) return
      data = validated
    }

    let hidden = Boolean(row.hidden)
    if (op.hidden !== undefined && op.hidden !== hidden) {
      if (!collection.allow.hide) return fail('', `${collection.labelPlural} can't be hidden`)
      hidden = op.hidden
    }

    const json = JSON.stringify(data)
    await trx
      .from(TABLES.documents)
      .where('id', row.id)
      .update({ data: json, hidden, updated_by: user?.id ?? null, updated_at: now() })

    await this.#revision(trx, user, {
      kind: 'document',
      target: `${collection.name}:${row.id}`,
      action: 'save',
      data: json,
      hidden,
    })
  }

  async #deleteDocument(
    trx: TransactionClientContract,
    op: Extract<CommitOp, { type: 'doc.delete' }>,
    user: CmsUser | null,
    fail: (path: string, message: string) => void
  ) {
    const collection = this.collection(op.collection)
    if (!collection.allow.delete) return fail('', `${collection.labelPlural} can't be deleted`)

    const deleted = await trx
      .from(TABLES.documents)
      .where({ collection: collection.name, id: op.id })
      .delete()
    if (!deleted) return

    await this.#revision(trx, user, {
      kind: 'document',
      target: `${collection.name}:${op.id}`,
      action: 'delete',
      data: null,
      hidden: null,
    })
  }

  async #reorder(
    trx: TransactionClientContract,
    op: Extract<CommitOp, { type: 'doc.reorder' }>,
    created: CommitResponse['created'],
    fail: (path: string, message: string) => void
  ) {
    const collection = this.collection(op.collection)
    if (!collection.allow.reorder) return fail('', `${collection.labelPlural} can't be reordered`)

    const ids = op.ids.map((id) => (typeof id === 'string' ? created[id]?.id : id))
    const rows = await trx.from(TABLES.documents).where('collection', collection.name).select('id')
    const existing = new Set(rows.map((row: { id: number }) => Number(row.id)))

    if (ids.length !== existing.size || !ids.every((id) => id !== undefined && existing.has(id))) {
      return fail(
        '',
        `The list of ${collection.labelPlural.toLowerCase()} changed. Reload and try again`
      )
    }

    for (const [order, id] of ids.entries()) {
      await trx.from(TABLES.documents).where('id', id!).update({ sort_order: order })
    }
  }

  /** Validates values against fields; reports errors by field path */
  async #validate(
    fields: Record<string, Field>,
    data: Record<string, unknown>,
    fail: (path: string, message: string) => void
  ): Promise<Record<string, JsonValue> | null> {
    try {
      return (await vine.validate({
        schema: this.compiler.fields(fields),
        data,
      })) as Record<string, JsonValue>
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        for (const message of error.messages as { field: string; message: string }[]) {
          fail(message.field, message.message)
        }
        return null
      }
      throw error
    }
  }

  async #uniqueSlug(
    trx: TransactionClientContract,
    collection: Collection,
    data: Record<string, JsonValue>
  ) {
    if (!collection.slugFrom) return null
    const base = slugify(String(data[collection.slugFrom] ?? '')) || collection.name
    for (let n = 1; ; n++) {
      const slug = n === 1 ? base : `${base}-${n}`
      const taken = await trx
        .from(TABLES.documents)
        .where({ collection: collection.name, slug })
        .first()
      if (!taken) return slug
    }
  }

  async #revision(
    trx: TransactionClientContract,
    user: CmsUser | null,
    revision: {
      kind: 'section' | 'document'
      target: string
      action: Revision['action']
      data: string | null
      hidden: boolean | null
    }
  ) {
    await trx.table(TABLES.revisions).insert({
      ...revision,
      user_id: user?.id ?? null,
      user_name: user?.name ?? null,
      created_at: now(),
    })
  }

  /*
  |--------------------------------------------------------------------------
  | History and media
  |--------------------------------------------------------------------------
  */

  /** The last 25 revisions of a section or collection item */
  async history(target: HistoryTarget): Promise<Revision[]> {
    let kind: string
    let key: string
    if ('section' in target) {
      if (!this.page(target.page).sections[target.section]) {
        throw new Exception('Unknown section', { status: 404 })
      }
      kind = 'section'
      key = `${target.page}.${target.section}`
    } else {
      this.collection(target.collection)
      kind = 'document'
      key = `${target.collection}:${target.id}`
    }

    const rows = await db
      .from(TABLES.revisions)
      .where({ kind, target: key })
      .orderBy('id', 'desc')
      .limit(25)

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      data: parse(row.data),
      hidden: row.hidden === null ? null : Boolean(row.hidden),
      user: row.user_name,
      createdAt: new Date(row.created_at).toISOString(),
    }))
  }

  #customMediaKeys: CustomMediaKeys = (field, value) =>
    this.config.fieldTypes.find((t) => t.name === field.component)?.mediaKeys?.(value, field) ?? []

  /** Media keys referenced by schema defaults (static, from code) */
  defaultMediaKeys(): Set<string> {
    const keys = new Set<string>()
    for (const page of this.pages.values()) {
      for (const section of Object.values(page.sections)) {
        const defaults = resolveSection(section)
        for (const key of mediaKeysInFields(section.fields, defaults, this.#customMediaKeys)) {
          keys.add(key)
        }
      }
    }
    for (const collection of this.collections.values()) {
      for (const item of collection.initial) {
        for (const key of mediaKeysInFields(collection.fields, item, this.#customMediaKeys)) {
          keys.add(key)
        }
      }
    }
    return keys
  }

  /** Media keys used anywhere in current content (defaults, edits, items) */
  async mediaKeysInUse(): Promise<Set<string>> {
    const keys = this.defaultMediaKeys()
    for (const page of this.pages.values()) {
      const values = await this.sections(page.name)
      for (const [name, section] of Object.entries(page.sections)) {
        for (const key of mediaKeysInFields(section.fields, values[name], this.#customMediaKeys)) {
          keys.add(key)
        }
      }
    }
    for (const collection of this.collections.values()) {
      for (const doc of await this.#allDocuments(collection.name)) {
        for (const key of mediaKeysInFields(collection.fields, doc.data, this.#customMediaKeys)) {
          keys.add(key)
        }
      }
    }
    return keys
  }
}
