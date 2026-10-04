---
layout: home

hero:
  name: CMS
  text: Edit the real website
  tagline: Schema-driven content editing for AdonisJS + Inertia + Vue + Nuxt UI sites. Staff click Edit on any section, a generated form slides out, the page previews every change, and Save commits everything at once.
  actions:
    - theme: brand
      text: Install it
      link: /installing
    - theme: alt
      text: How it works
      link: /architecture
    - theme: alt
      text: Schema reference
      link: /schema

features:
  - title: One schema, three jobs
    details: A section's schema is its code defaults, its editing form and its server validation. Nothing to keep in sync, and no migrations, routes or form components per page.
  - title: Live preview, atomic save
    details: Edits are drafts layered over the page's real props, so the site previews them as staff type. Save sends every change as one commit, all or nothing, with errors on the exact fields.
  - title: Sections and collections
    details: Sections are blocks of a page (a hero, a banner). Collections are lists of records (locations, specials) with add, hide, delete and reorder, stored as JSON documents.
  - title: History and media safety
    details: Every save is a revision you can restore. Images and files used anywhere in content are reported as in use, so the media library can refuse to delete them.
  - title: One-command install
    details: 'node ace configure @martipops/cms-adonis wires up the provider, config, migration, routes, Vite and Vue plugins. cms:make:page, collection and field scaffold the rest.'
  - title: Three small packages
    details: '@martipops/cms-core (the schema DSL, no dependencies), cms-adonis (storage, validation, endpoints) and cms-vue (components and generated forms).'
---

## Two-minute tour

**1. Describe content as a schema.** The same file defines the defaults, the editing form and the validation:

```ts
// app/cms/pages/home.ts
import { f, definePage, section } from '@martipops/cms-core'

export default definePage('home', {
  hero: section('Hero', {
    title: f.text({ default: 'Fresh pizza daily', max: 120 }),
    image: f.image({ label: 'Photo', default: 'images/hero.webp' }),
    buttons: f.list({ label: f.text({ max: 30 }), link: f.link() }, { max: 3, itemTitle: 'label' }),
  }),
})
```

**2. Send it from a controller:**

```ts
return ctx.inertia.render('home', { content: await cms.pageProps('home', ctx) })
```

**3. Render it.** Edit mode lights up on its own for signed-in editors:

```vue
<CmsPage :content="content">
  <CmsSection v-slot="{ data }" name="hero">
    <h1>{{ data.title }}</h1>
  </CmsSection>
</CmsPage>
```

For lists of records (locations, menu items, events), `defineCollection` plus `CmsCollection` gives you collapsible item forms with add, hide, delete and reorder.

## Where to next

| Read                          | When                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| [Installing](/installing)     | Adding the CMS to a new site                                      |
| [Architecture](/architecture) | You want the mental model: data flow, storage, drafts, guarantees |
| [Schema reference](/schema)   | Writing schemas, all field types, custom field types              |
| [Server reference](/server)   | `config/cms.ts`, the `Cms` service API, tables, testing           |
| [Client reference](/client)   | Components, slots, the plugin, the draft store                    |
| [Commit protocol](/protocol)  | The wire format: ops, refs, errors, history                       |
| [Decisions](/decisions)       | Why it works the way it does (and what was rejected)              |
| [Roadmap](/roadmap)           | What's next, with technical designs                               |
