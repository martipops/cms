import { cp, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import Configure from '@adonisjs/core/commands/configure'
import type { BaseCommand } from '@adonisjs/core/ace'
import { configure } from '../configure.js'
import MakePage from '../commands/make_page.js'
import MakeCollection from '../commands/make_collection.js'
import MakeField from '../commands/make_field.js'

/**
 * Runs the installer and generators against a copy of a fresh Adonis +
 * Inertia + Nuxt UI app (tests/fixtures/starter)
 */
async function starterApp() {
  // Inside the package so the app resolves @adonisjs/* and @martipops/* like a real one
  await mkdir(join(import.meta.dirname, '../tmp'), { recursive: true })
  const root = await mkdtemp(join(import.meta.dirname, '../tmp/starter-'))
  await cp(join(import.meta.dirname, 'fixtures/starter'), root, { recursive: true })
  const app = new IgnitorFactory()
    .withCoreConfig()
    .withCoreProviders()
    .create(new URL(`file://${root}/`))
    .createApp('console')
  await app.init()
  await app.boot()
  const ace = await app.container.make('ace')
  ace.ui.switchMode('raw')

  const read = (path: string) => readFile(join(root, path), 'utf8')
  const run = async <T extends typeof BaseCommand>(Command: T, args: string[]) => {
    const command = await ace.create(Command, args)
    await command.exec()
    if (command.error) throw command.error
    return command
  }
  // KEEP_STARTER=1 keeps the generated app in tmp/ for inspection
  const cleanup = () =>
    process.env.KEEP_STARTER ? undefined : rm(root, { recursive: true, force: true })
  return { root, app, ace, read, run, cleanup }
}

test.group('Installer', () => {
  test('configure wires the CMS into a fresh app', async ({ assert, cleanup }) => {
    const starter = await starterApp()
    cleanup(starter.cleanup)

    const command = await starter.ace.create(Configure, ['@martipops/cms-adonis'])
    await configure(command)

    const rc = await starter.read('adonisrc.ts')
    assert.include(rc, `import('@martipops/cms-adonis/cms_provider')`)
    assert.include(rc, `import('@martipops/cms-adonis/commands')`)

    assert.include(await starter.read('config/cms.ts'), 'authorize: (_ctx: HttpContext) => false')

    const [migration] = await readdir(join(starter.root, 'database/migrations'))
    assert.match(migration, /^\d+_create_cms_tables\.ts$/)
    assert.include(await starter.read(`database/migrations/${migration}`), 'cmsTablesV1.up')

    const routes = await starter.read('start/routes.ts')
    assert.include(routes, `import { registerCmsRoutes } from '@martipops/cms-adonis'`)
    assert.include(routes, `import { middleware } from '#start/kernel'\n`)
    assert.notMatch(routes, /;$/m)
    assert.include(
      routes,
      `router.group(() => registerCmsRoutes(router)).prefix('admin/cms').use(middleware.auth())`
    )

    const vue = await starter.read('inertia/app.ts')
    assert.include(vue, `import cms from '@martipops/cms-vue'`)
    assert.include(
      vue,
      `      .use(ui)\n      .use(cms, { endpoint: '/admin/cms' })\n      .mount(el)`
    )

    const viteConfig = await starter.read('vite.config.ts')
    assert.include(viteConfig, `import cms from '@martipops/cms-vue/vite'`)
    assert.match(viteConfig, /plugins: \[[^\]]*cms\(\)/s)

    const css = await starter.read('inertia/css/app.css')
    assert.include(css, `@import '@nuxt/ui';\n@import '@martipops/cms-vue/tailwind.css';`)

    // Running it again changes nothing
    const before = [routes, vue, css, viteConfig]
    await configure(await starter.ace.create(Configure, ['@martipops/cms-adonis']))
    assert.deepEqual(
      [
        await starter.read('start/routes.ts'),
        await starter.read('inertia/app.ts'),
        await starter.read('inertia/css/app.css'),
        await starter.read('vite.config.ts'),
      ],
      before
    )
  }).timeout(30_000)

  test('make commands create schemas and register them', async ({ assert, cleanup }) => {
    const starter = await starterApp()
    cleanup(starter.cleanup)
    await configure(await starter.ace.create(Configure, ['@martipops/cms-adonis']))

    await starter.run(MakePage, ['about_us'])
    await starter.run(MakeCollection, ['team_member'])
    await starter.run(MakeField, ['opening_hours'])

    const page = await starter.read('app/cms/pages/about_us.ts')
    assert.include(page, `definePage('aboutUs', {`)
    assert.include(page, `f.text({ default: 'About us', max: 120, required: true })`)
    assert.include(page, '<h1>{{ data.title }}</h1>')
    assert.include(
      page,
      `inertia.render('about_us', { content: await cms.pageProps('aboutUs', ctx) })`
    )

    const collection = await starter.read('app/cms/collections/team_members.ts')
    assert.include(collection, `defineCollection('teamMembers', {`)
    assert.include(collection, `label: 'Team member',`)
    assert.include(collection, `labelPlural: 'Team members',`)

    assert.include(await starter.read('app/cms/fields/opening_hours.ts'), `name: 'openingHours'`)
    assert.include(
      await starter.read('inertia/components/cms/opening_hours_field.vue'),
      'Editor for the "openingHours" field type'
    )

    const config = await starter.read('config/cms.ts')
    assert.notMatch(config, /;$/m)
    assert.include(config, `import aboutUsPage from '../app/cms/pages/about_us.js'`)
    assert.include(config, `import teamMembers from '../app/cms/collections/team_members.js'`)
    assert.include(config, `import { openingHoursType } from '../app/cms/fields/opening_hours.js'`)
    assert.match(config, /pages: \[\s*aboutUsPage\s*\]/)
    assert.match(config, /collections: \[\s*teamMembers\s*\]/)
    assert.match(config, /fieldTypes: \[\s*openingHoursType\s*\]/)
  }).timeout(30_000)
})
