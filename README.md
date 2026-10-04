# CMS library

A drop-in content editing system for **AdonisJS + Inertia + Vue + Nuxt UI** sites. Staff edit the real website: every section has an **Edit** button that opens a form in a slide-out panel. The form is generated from a schema, and the page previews each change as it's typed. **Save** commits every change at once, in one transaction.

```
packages/
├── cms-core/     schema DSL, shared by server and browser (no dependencies)
├── cms-adonis/   storage, validation, commit + history endpoints
├── cms-vue/      CmsPage · CmsSection · CmsCollection · CmsToolbar · generated forms
└── docs/         everything below
```

It was built for a client site and is developed inside that repo as npm workspaces. It moves to its own repo once the API settles.

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

For lists of records (locations, menu items, events), `defineCollection` plus `<CmsCollection>` gives you collapsible item forms with add, hide, delete and reorder. Neither sections nor collections need migrations, routes or form components.

## Documentation

| Doc                                  | Read it when                                                      |
| ------------------------------------ | ----------------------------------------------------------------- |
| [Installing](docs/installing.md)     | Adding the CMS to a new site                                      |
| [Architecture](docs/architecture.md) | You want the mental model: data flow, storage, drafts, guarantees |
| [Schema reference](docs/schema.md)   | Writing schemas, all field types, custom field types              |
| [Server reference](docs/server.md)   | `config/cms.ts`, the `Cms` service API, tables, testing           |
| [Client reference](docs/client.md)   | Components, slots, the plugin, the draft store                    |
| [Commit protocol](docs/protocol.md)  | The wire format: ops, refs, errors, history                       |
| [Decisions](docs/decisions.md)       | Why it works the way it does (and what we rejected)               |
| [Roadmap](docs/roadmap.md)           | What's next, with technical designs                               |

## Status

| Capability                                                    | State                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| Schema DSL with type inference (13 field types + custom)      | ✅ Built                                               |
| Sections: code defaults, sparse edits, reset to default       | ✅ Built                                               |
| Collections as JSON documents (create, hide, delete, reorder) | ✅ Built                                               |
| Generated slide-out forms with nested groups and lists        | ✅ Built                                               |
| Live preview of unsaved drafts, anywhere on the site          | ✅ Built                                               |
| Atomic multi-change commit with per-field errors              | ✅ Built                                               |
| Revision history with restore                                 | ✅ Built                                               |
| Media-in-use protection across all content                    | ✅ Built (media library itself lives in the app)       |
| Custom field types (server validator + editor component)      | ✅ Built                                               |
| Media library inside the package                              | 🧭 [Planned](docs/roadmap.md#media-module)             |
| `node ace configure` installer and `cms:make:*` generators    | ✅ Built                                               |
| Typed slot data (`data.title: string`)                        | 🧭 [Planned](docs/roadmap.md#typed-content)            |
| Lucid-model-backed collections                                | 🧭 [Planned](docs/roadmap.md#model-backed-collections) |
| Conflict detection, drafts/publishing, presence, AI assist, … | 🔭 [Roadmap](docs/roadmap.md)                          |

## Working on the library

- `npm run dev` from the app root builds `cms-core` and `cms-adonis` in watch mode next to the dev server. `cms-vue` ships as `.vue` source, which the app's Vite compiles.
- Each package has its own suite: `npm test -w @martipops/cms-core` (pure functions) and `npm test -w @martipops/cms-adonis` (a minimal app on in-memory SQLite). Neither needs anything from the site. The root `npm test` runs both, then the site's own tests.
- Any change to the commit protocol must update [protocol.md](docs/protocol.md) and both packages in the same commit.
