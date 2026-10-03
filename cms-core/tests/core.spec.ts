import { test } from '@japa/runner'
import {
  defaultsOf,
  defineCollection,
  definePage,
  f,
  mediaKeysInFields,
  resolveSection,
  section,
  slugify,
  type SectionValues,
} from '../src/index.js'

const hero = section('Hero', {
  title: f.text({ default: 'Hello', max: 40 }),
  image: f.image({ default: 'images/hero.webp' }),
  cta: f.link({ default: { label: 'Menu', url: '/media/files/menu.pdf' } }),
  stats: f.list(
    { value: f.text(), label: f.text(), icon: f.icon({ options: [{ value: 'i-a', label: 'A' }] }) },
    { default: [{ value: '1979', label: 'Opened', icon: 'i-a' }], itemTitle: 'label' }
  ),
  meta: f.group({ featured: f.boolean(), size: f.select({ options: ['s', 'm', 'l'] }) }),
})

test.group('CMS core', () => {
  test('labels missing from field definitions are derived from keys', ({ assert }) => {
    const collection = defineCollection('things', {
      label: 'Thing',
      titleField: 'name',
      fields: { name: f.text(), orderOnlineUrl: f.url() },
    })
    assert.equal(collection.fields.orderOnlineUrl.label, 'Order online url')
    assert.equal(collection.labelPlural, 'Things')
    assert.equal(hero.fields.stats.item.value.label, 'Value')
    assert.equal(hero.fields.meta.fields.featured.label, 'Featured')
  })

  test('sections resolve to defaults with edited fields applied', ({ assert }) => {
    const values: SectionValues<typeof hero> = resolveSection(hero, { title: 'Edited' })
    assert.equal(values.title, 'Edited')
    assert.equal(values.image, 'images/hero.webp')
    assert.deepEqual(values.meta, { featured: false, size: 's' })
  })

  test('stored values are brought in line with the current schema', ({ assert }) => {
    const values = resolveSection(hero, {
      title: 42,
      stats: [{ value: '4', removedKey: 'x' }, 'not an item'],
      meta: { size: 'xl' },
    })
    assert.equal(values.title, 'Hello')
    assert.deepEqual(values.stats, [
      { value: '4', label: '', icon: 'i-a' },
      { value: '', label: '', icon: 'i-a' },
    ])
    assert.deepEqual(values.meta, { featured: false, size: 's' })
  })

  test('defaults for a new item', ({ assert }) => {
    assert.deepEqual(defaultsOf(hero.fields.stats.item), { value: '', label: '', icon: 'i-a' })
  })

  test('media keys are found in images, links and nested fields', ({ assert }) => {
    const gallery = section('Gallery', {
      photos: f.list({ photo: f.image() }),
      hours: f.custom('weeklyHours', { default: { image: 'images/x.webp' } }),
    })
    const keys = mediaKeysInFields(
      { ...hero.fields, ...gallery.fields },
      {
        ...resolveSection(hero),
        photos: [{ photo: 'images/a.webp' }, { photo: null }],
        hours: { image: 'images/x.webp' },
      },
      { baseUrl: '/media/', custom: (_field, value) => [(value as { image: string }).image] }
    )
    assert.sameMembers(keys, [
      'images/hero.webp',
      'files/menu.pdf',
      'images/a.webp',
      'images/x.webp',
    ])
  })

  test('field keys must be plain identifiers', ({ assert }) => {
    assert.throws(
      () => definePage('home', { hero: section('Hero', { 'hero.title': f.text() }) }),
      /plain identifier/
    )
  })

  test('media links count under any base URL', ({ assert }) => {
    const fields = { menu: f.link(), site: f.url(), photo: f.image({ folder: 'photos' }) }
    const values = {
      menu: { label: 'Menu', url: 'https://cdn.example.com/files/menu.pdf' },
      site: '/media/files/elsewhere.pdf',
      photo: 'photos/a.webp',
    }
    const keys = mediaKeysInFields(fields, values, { baseUrl: 'https://cdn.example.com/' })
    assert.sameMembers(keys, ['files/menu.pdf', 'photos/a.webp'])
  })

  test('slugify', ({ assert }) => {
    assert.equal(slugify("Joe's — Holiday Manor!"), 'joe-s-holiday-manor')
    assert.equal(slugify('Café Crème'), 'cafe-creme')
  })
})
