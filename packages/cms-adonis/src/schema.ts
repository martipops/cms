import type { BaseSchema } from '@adonisjs/lucid/schema'
import { cmsTables } from './tables.js'

type SchemaBuilder = BaseSchema['schema']

/**
 * The CMS tables, as versioned steps an app's migrations call:
 *
 *   export default class extends BaseSchema {
 *     async up() { cmsTablesV1.up(this.schema) }
 *     async down() { cmsTablesV1.down(this.schema) }
 *   }
 *
 * A released version never changes, so a migration that ran once always
 * means the same thing. Schema changes ship as a new version (V2) that apps
 * add as a new migration.
 */
export const cmsTablesV1 = {
  up(schema: SchemaBuilder, prefix = 'cms_') {
    const tables = cmsTables(prefix)

    // Edited fields only; defaults live in code
    schema.createTable(tables.sections, (table) => {
      table.increments('id').notNullable()
      table.string('page', 60).notNullable()
      table.string('section', 60).notNullable()
      table.text('data').notNullable()
      table.string('updated_by', 60).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['page', 'section'])
    })

    schema.createTable(tables.documents, (table) => {
      table.increments('id').notNullable()
      table.string('collection', 60).notNullable()
      table.string('slug', 120).nullable()
      table.text('data').notNullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('hidden').notNullable().defaultTo(false)
      table.string('created_by', 60).nullable()
      table.string('updated_by', 60).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['collection', 'slug'])
      table.index(['collection', 'sort_order'])
    })

    schema.createTable(tables.revisions, (table) => {
      table.increments('id').notNullable()
      table.string('kind', 20).notNullable()
      table.string('target', 160).notNullable()
      table.string('action', 20).notNullable()
      table.text('data').nullable()
      table.boolean('hidden').nullable()
      table.string('user_id', 60).nullable()
      table.string('user_name').nullable()
      table.timestamp('created_at').notNullable()
      table.index(['kind', 'target'])
    })

    schema.createTable(tables.seeds, (table) => {
      table.string('collection', 60).primary()
      table.timestamp('seeded_at').notNullable()
    })
  },

  down(schema: SchemaBuilder, prefix = 'cms_') {
    const tables = cmsTables(prefix)
    for (const table of [tables.seeds, tables.revisions, tables.documents, tables.sections]) {
      schema.dropTable(table)
    }
  },
}
