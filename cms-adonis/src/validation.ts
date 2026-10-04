import vine from '@vinejs/vine'
import type { FieldContext, SchemaTypes } from '@vinejs/vine/types'
import type { Field } from '@martipops/cms-core'
import type { CmsConfig } from './types.js'

/**
 * Turns field definitions into VineJS schemas. Validation rules come from
 * the definitions themselves, so there's nothing to keep in sync.
 */

/** Internal links ("/about", "/media/files/menu.pdf"), mailto/tel, or http(s) URLs */
const LINK_URL = /^(\/(?!\/)|https?:\/\/|mailto:|tel:)/

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export class SchemaCompiler {
  #mediaRule: ReturnType<typeof vine.createRule<{ folder: string }>>

  constructor(private config: Pick<CmsConfig, 'fieldTypes' | 'media'>) {
    this.#mediaRule = vine.createRule<{ folder: string }>(
      async (value: unknown, { folder }: { folder: string }, field: FieldContext) => {
        if (typeof value !== 'string' || !field.isValid) return
        if (!value.startsWith(`${folder}/`) || !(await this.config.media!.exists(value, folder))) {
          field.report('Choose a file from the media library', 'media', field)
        }
      },
      { name: 'media', isAsync: true }
    )
  }

  field(field: Field): SchemaTypes {
    switch (field.type) {
      case 'text': {
        let schema = vine.string().trim().maxLength(field.max)
        if (field.required) schema = schema.minLength(1)
        if (!field.multiline) schema = schema.regex(/^[^\n\r]*$/)
        return schema
      }
      case 'number': {
        let schema = vine.number()
        if (field.min !== undefined) schema = schema.min(field.min)
        if (field.max !== undefined) schema = schema.max(field.max)
        if (field.integer) schema = schema.withoutDecimals()
        return schema.nullable()
      }
      case 'boolean':
        return vine.boolean({ strict: true })
      case 'select':
      case 'icon':
        return vine.enum(field.options.map((option) => option.value))
      case 'image':
      case 'file': {
        if (!this.config.media) {
          throw new Error(`${field.type} fields need the media option in config/cms.ts`)
        }
        const schema = vine.string().use(this.#mediaRule({ folder: field.folder }))
        return field.required ? schema : schema.nullable()
      }
      case 'link':
        return vine.object({
          label: vine.string().trim().minLength(1).maxLength(80),
          url: vine.string().trim().maxLength(500).regex(LINK_URL),
        })
      case 'url': {
        const prefix = field.prefixes?.length
          ? `(${field.prefixes.map(escape).join('|')})`
          : LINK_URL.source.slice(1)
        // Optional URLs may be left empty
        const pattern = new RegExp(field.required ? `^${prefix}` : `^$|^${prefix}`)
        return vine.string().trim().maxLength(2000).regex(pattern)
      }
      case 'group':
        return this.fields(field.fields)
      case 'list':
        return vine.array(this.fields(field.item)).minLength(field.min).maxLength(field.max)
      case 'custom': {
        const type = this.config.fieldTypes.find((t) => t.name === field.component)
        if (!type) throw new Error(`Unknown CMS field type "${field.component}"`)
        return type.validator(field)
      }
    }
  }

  fields(fields: Record<string, Field>) {
    return vine.object(
      Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, this.field(field)]))
    )
  }
}
