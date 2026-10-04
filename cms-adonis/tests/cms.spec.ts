import { test } from '@japa/runner'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { defineCollection, definePage, f, section } from '@martipops/cms-core'
import { Cms, CommitValidationError, cmsTablesV1, defineConfig, defineFieldType } from '../index.js'

/** Files the fake media library has */
const library = new Set(['images/hero.webp'])

const weekdays = defineFieldType({
  name: 'weekdays',
  validator: () => vine.array(vine.enum(['mon', 'tue', 'wed'])).maxLength(3),
})

const home = definePage('home', {
  hero: section('Hero', {
    title: f.text({ default: 'Fresh pizza', max: 20 }),
    image: f.image({ default: 'images/hero.webp' }),
    stats: f.list({ value: f.text({ max: 5 }) }, { max: 2, default: [{ value: '1979' }] }),
  }),
})

const places = defineCollection('places', {
  label: 'Place',
  titleField: 'name',
  slugFrom: 'name',
  allow: { delete: false },
  fields: {
    name: f.text({ required: true, max: 40 }),
    photo: f.image(),
    open: f.custom('weekdays', { default: [] as string[] }),
  },
  initial: [
    { slug: 'downtown', name: 'Downtown', photo: null, open: ['mon'] },
    { name: 'Uptown', photo: null, open: [] },
  ],
})

function makeCms() {
  return new Cms(
    defineConfig({
      pages: [home],
      collections: [places],
      fieldTypes: [weekdays],
      authorize: () => true,
      media: {
        exists: async (key, folder) => key.startsWith(`${folder}/`) && library.has(key),
      },
    })
  )
}

async function heroTitle(cms: Cms) {
  const { hero } = await cms.sections('home')
  return hero.title
}

async function commitErrors(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (error instanceof CommitValidationError) return error.errors
    throw error
  }
  throw new Error('Expected the commit to fail')
}

test.group('CMS library', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('sections render defaults and save only edited fields', async ({ assert }) => {
    const cms = makeCms()
    assert.equal(await heroTitle(cms), 'Fresh pizza')

    await cms.commit(
      [{ type: 'section.save', page: 'home', section: 'hero', changes: { title: 'Hot pie' } }],
      { id: 1, name: 'Sam' }
    )
    const { hero } = await cms.sections('home')
    assert.equal(hero.title, 'Hot pie')
    assert.equal(hero.image, 'images/hero.webp')

    await cms.commit(
      [{ type: 'section.save', page: 'home', section: 'hero', changes: {}, reset: ['title'] }],
      null
    )
    assert.equal(await heroTitle(cms), 'Fresh pizza')

    const history = await cms.history({ page: 'home', section: 'hero' })
    assert.deepEqual(
      history.map((r) => [r.data, r.user]),
      [
        [{}, null],
        [{ title: 'Hot pie' }, 'Sam'],
      ]
    )
  })

  test('reports every invalid field and saves nothing', async ({ assert }) => {
    const cms = makeCms()
    const errors = await commitErrors(
      cms.commit(
        [
          { type: 'section.save', page: 'home', section: 'hero', changes: { title: 'Fine' } },
          {
            type: 'section.save',
            page: 'home',
            section: 'hero',
            changes: {
              title: 'Way too long for this field',
              image: 'images/missing.webp',
              stats: [{ value: 'toolong' }],
            },
          },
        ],
        null
      )
    )
    assert.sameMembers(
      errors.map((e) => `${e.op}:${e.path}`),
      ['1:title', '1:image', '1:stats.0.value']
    )
    assert.equal(await heroTitle(cms), 'Fresh pizza')
  })

  test('collections seed once and support create, update, hide and reorder', async ({ assert }) => {
    const cms = makeCms()
    const seeded = await cms.items('places')
    assert.deepEqual(
      seeded.map((p) => p.slug),
      ['downtown', 'uptown']
    )

    const { created } = await cms.commit(
      [
        { type: 'doc.create', collection: 'places', ref: 'new', data: { name: 'Downtown' } },
        { type: 'doc.update', collection: 'places', id: seeded[0].id, hidden: true },
        {
          type: 'doc.update',
          collection: 'places',
          id: seeded[1].id,
          data: { open: ['tue', 'wed'] },
        },
        { type: 'doc.reorder', collection: 'places', ids: ['new', seeded[1].id, seeded[0].id] },
      ],
      null
    )
    assert.equal(created.new.slug, 'downtown-2')

    const visible = await cms.items('places')
    assert.deepEqual(
      visible.map((p) => p.slug),
      ['downtown-2', 'uptown']
    )
    assert.deepEqual(visible[1].data.open, ['tue', 'wed'])
    assert.lengthOf(await cms.items('places', { includeHidden: true }), 3)
    assert.isNull(await cms.find('places', 'downtown'))

    // A fresh instance (e.g. after a restart) doesn't seed again
    cms.clearCache()
    assert.lengthOf(await makeCms().items('places', { includeHidden: true }), 3)
  })

  test('collection permissions and custom field validation', async ({ assert }) => {
    const cms = makeCms()
    const [first] = await cms.items('places')
    const errors = await commitErrors(
      cms.commit(
        [
          { type: 'doc.delete', collection: 'places', id: first.id },
          { type: 'doc.update', collection: 'places', id: first.id, data: { open: ['sun'] } },
          { type: 'doc.create', collection: 'places', ref: 'x', data: { name: '' } },
        ],
        null
      )
    )
    assert.deepEqual(
      errors.map((e) => `${e.op}:${e.path}`),
      ['0:', '1:open.0', '2:name']
    )
  })

  test('tables follow the configured prefix', async ({ assert }) => {
    const schema = db.connection().schema
    cmsTablesV1.up(schema, 'site_')
    await schema

    const plain = definePage('plain', { intro: section('Intro', { title: f.text() }) })
    const cms = new Cms(
      defineConfig({ pages: [plain], authorize: () => true, tablePrefix: 'site_' })
    )
    await cms.commit(
      [{ type: 'section.save', page: 'plain', section: 'intro', changes: { title: 'Hi' } }],
      null
    )
    assert.lengthOf(await db.from('site_sections'), 1)
    assert.lengthOf(await db.from('site_revisions'), 1)
    assert.lengthOf(await db.from('cms_sections'), 0)
  })

  test('image and file fields need the media option', ({ assert }) => {
    assert.throws(
      () => new Cms(defineConfig({ pages: [home], authorize: () => true })),
      /need the media option/
    )
    const plain = definePage('plain', { intro: section('Intro', { title: f.text() }) })
    assert.doesNotThrow(() => new Cms(defineConfig({ pages: [plain], authorize: () => true })))
  })

  test('media used by defaults, edits and items is reported in use', async ({ assert }) => {
    const cms = makeCms()
    library.add('images/edited.webp')
    const [first] = await cms.items('places')
    await cms.commit(
      [
        {
          type: 'doc.update',
          collection: 'places',
          id: first.id,
          data: { photo: 'images/edited.webp' },
        },
      ],
      null
    )
    const keys = await cms.mediaKeysInUse()
    assert.isTrue(keys.has('images/hero.webp'))
    assert.isTrue(keys.has('images/edited.webp'))
  })
})
