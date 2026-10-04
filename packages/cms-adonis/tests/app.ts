import { IgnitorFactory } from '@adonisjs/core/factories'
import { defineConfig } from '@adonisjs/lucid'
import type { ApplicationService } from '@adonisjs/core/types'
import { cmsTablesV1 } from '../src/schema.js'

/**
 * A minimal Adonis app for the package's own tests: Lucid on an in-memory
 * SQLite database, with the CMS tables created from `cmsTablesV1`.
 */
export async function createTestApp(): Promise<ApplicationService> {
  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .merge({
      rcFileContents: {
        providers: [() => import('@adonisjs/lucid/database_provider')],
      },
      config: {
        database: defineConfig({
          connection: 'sqlite',
          connections: {
            sqlite: {
              client: 'better-sqlite3',
              connection: { filename: ':memory:' },
              useNullAsDefault: true,
            },
          },
        }),
      },
    })
    .create(new URL('../tmp/', import.meta.url))

  const app = ignitor.createApp('test')
  await app.init()
  await app.boot()

  const db = await app.container.make('lucid.db')
  const schema = db.connection().schema
  cmsTablesV1.up(schema)
  await schema

  return app
}
