# Roadmap

Each item below is a design sketch, written against the code that exists today. It covers why it's worth doing, how it would work, what the API would look like, what changes in storage, and what could go wrong. Sizes are rough: **S** is about a day, **M** a few days, **L** a week or more.

Items are grouped into horizons. Each horizon assumes the previous one, but most items can ship independently.

- [Horizon 1 · Make it a product](#horizon-1--make-it-a-product)
- [Horizon 2 · Editor superpowers](#horizon-2--editor-superpowers)
- [Horizon 3 · Platform](#horizon-3--platform)
- [Horizon 4 · Restaurant pack](#horizon-4--restaurant-pack)
- [Moonshots](#moonshots)
- [Ordering](#suggested-order)

---

## Horizon 1 · Make it a product

Things a second site needs before the library can be called reusable.

### Media module

**Why.** Every site needs a media library, and today the CMS borrows the app's. That coupling is held together by two config hooks (`media.exists`, `mediaPicker`).

**Design.** Move `MediaService`, the controller, the model, the validators and `media_library.vue` / `media_picker_modal.vue` into the packages, behind a **storage adapter** built on Adonis Drive:

```ts
// config/cms.ts
media: {
  disk: 'fs',                         // any @adonisjs/drive disk (fs, s3, gcs, r2)
  folders: { images: ['jpg', 'png', 'webp', 'avif', 'gif'], pdfs: ['pdf'], files: ['docx', 'xlsx', 'zip'] },
  images: { maxDimension: 2400, format: 'webp', quality: 80 },
  serve: '/media',                    // or 'cdn' with a base URL
}
```

- `media.exists` and the in-use check become internal. `registerCmsRoutes` also mounts the media routes.
- `cms-vue` ships `CmsMediaLibrary` and `CmsMediaPicker`, and the `mediaPicker` option becomes optional (an override).
- **Responsive variants:** generate `-640w`, `-1280w` and `-2400w` WebP/AVIF files on upload, and add `<CmsImage :src="key" sizes="…">`, which renders `srcset`.
- **Focal points:** `media.focal_x/focal_y`, set by clicking the image in the library. `CmsImage` turns them into `object-position`, so crops keep faces in frame on every breakpoint.

**Storage.** Moves the `media` table into the package's migration (as `cms_media`, with a compatibility option for the existing table name). New columns: `focal_x`, `focal_y`, `variants` JSON, `blurhash`.

**Risks.** Sharp is a native dependency, so the package needs it as a peer. Moving the existing media table needs a rename migration.

**Size.** L

### Installer

**Why.** [Installing](installing.md) has nine manual steps. `node ace add @sonata/cms-adonis` should do them all.

**Design.** Adonis's `configure` hook with codemods:

1. `codemods.updateRcFile`: register the provider and the `cms:*` commands
2. `codemods.makeUsingStub`: `config/cms.ts`, the migration, `app/cms/pages/site.ts`
3. `codemods.registerMiddleware` / an `addRoutes`-style edit for `registerCmsRoutes`
4. Patch `inertia/app.ts` (`.use(cms, …)`) and `app.css` (`@source`) with ts-morph, and print a clear manual instruction if the file looks unusual
5. Ask whether to scaffold the toolbar into `inertia/layouts/default.vue`

Ship ace commands alongside it:

| Command                      | Does                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `cms:make:page <name>`       | Stub a page schema and print the controller and Vue snippets                                         |
| `cms:make:collection <name>` | Stub a collection schema                                                                             |
| `cms:make:field <name>`      | Stub a custom field type: server validator + Vue editor component                                    |
| `cms:doctor`                 | Report orphaned stored fields, unknown sections, media referenced but missing, invalid stored values |
| `cms:export` / `cms:import`  | See [content bundles](#content-bundles)                                                              |

**Size.** M

### Typed content

**Why.** Templates currently get `data` as `Record<string, JsonValue>`, so pages are full of `String(data.title)` and `data.images as {...}[]`. The schemas already know the exact types.

**Design.** Module augmentation keyed by page and section names, generated or hand-written:

```ts
// generated: .adonisjs/client/cms.d.ts (by an Adonis init hook, like indexPages)
import type home from '#cms/pages/home'
declare module '@sonata/cms-vue' {
  interface CmsPages {
    home: typeof home
  }
}
```

`CmsSection` becomes generic through `SlotsType`, with the page name inferred from `CmsPage`'s `content` prop:

```ts
type SectionData<P extends keyof CmsPages, S extends keyof CmsPages[P]['sections']> = SectionValues<
  CmsPages[P]['sections'][S]
>
```

Because `CmsPage` provides its page through injection, the section name can't be type-checked from the template alone. A `useCms('home')` helper returning a typed section accessor gives full types in `<script>`, and `<CmsSection page="home" name="hero">` checks the pair in templates.

**Bonus.** The same generator emits `ItemValues` aliases for every collection (`CmsItems['locations']`), replacing hand-written `LocationData` exports.

**Size.** M

### Model-backed collections

**Why.** Some data needs real columns: relations, a unique email, reporting queries, thousands of rows (career applications, catering orders).

**Design.** A `store` option on the collection, behind a `DocumentStore` interface that the commit pipeline already almost uses:

```ts
interface DocumentStore {
  all(collection): Promise<StoredDocument[]>
  create(trx, collection, data, meta): Promise<{ id; slug }>
  update(trx, id, data, meta): Promise<void>
  delete(trx, id): Promise<boolean>
  reorder(trx, ids): Promise<void>
}

defineCollection('menuItems', {
  store: lucidStore(MenuItem, {
    map: { name: 'name', price: 'price_cents', tags: { column: 'tags', json: true } },
    sort: 'sort_order',      // optional; disables reorder if absent
    hidden: 'is_hidden',     // optional
  }),
  fields: { … },
})
```

Validation, history, drafts and the editor are unchanged. Only persistence differs, so a collection can start as JSON documents and graduate to a model with a data migration.

**Risks.** Paging: the editor loads every item today. Large model-backed collections need a server-paged panel (search, filter, infinite scroll) and a `collectionProps({ page })` variant.

**Size.** L

### Multi-process cache

**Why.** The read cache is per process. Run two app instances (or a worker) and one serves stale content after the other commits.

**Design.** Version-stamped invalidation with no new infrastructure required:

- Add a `cms_versions(scope, version)` table, bumped in the commit transaction (`home`, `collection:locations`).
- Each cached entry remembers its version. A read checks the version table first: one indexed row per request, or once per N ms with a short TTL.
- Optional `redis` driver: publish `cms:invalidate <scope>` after commit, and subscribers drop their cache entry immediately.

The same version doubles as an **ETag**: `pageProps` responses carry `ETag: W/"home:42"`, and CDNs or the browser revalidate cheaply.

**Size.** S (version table) · M (Redis + ETags)

### Schema migrations

**Why.** Renaming a field silently loses its edits (see [schema changes](schema.md#schema-changes-over-time)).

**Design.** Two layers:

1. **Rename hints**, applied at read time and on the next save:

   ```ts
   headline: f.text({ was: ['eyebrow', 'kicker'] })
   ```

   `normalize` checks `was` keys when the current key is missing. `cms:doctor --fix` rewrites stored data permanently.

2. **Versioned transforms** for structural changes, run lazily per row:

   ```ts
   section('Hero', fields, {
     version: 2,
     migrate: { 2: (old) => ({ ...old, buttons: old.cta ? [old.cta] : [] }) },
   })
   ```

   Stored rows record their `schema_version`. Reads upgrade them in memory, and writes persist the upgraded shape.

**Size.** M

### Form layout

**Why.** The location form is 16 fields in one column. Designers need tabs, columns and fields that show only when relevant.

**Design.** Layout hints on fields and sections. They're pure presentation, and storage doesn't change:

```ts
section(
  'Location',
  {
    street: f.text({ width: 'full' }),
    city: f.text({ width: '1/2' }),
    state: f.text({ width: '1/4' }),
    zip: f.text({ width: '1/4' }),
    hasPatio: f.boolean(),
    patioHours: f.text({ visibleIf: { hasPatio: true } }),
  },
  {
    tabs: [
      { label: 'Basics', fields: ['name', 'blurb'] },
      { label: 'Hours', fields: ['hours'] },
    ],
  }
)
```

`visibleIf` is a small declarative condition (`eq`, `in`, `truthy`), not a function, so it serializes to the browser. The server skips validating hidden fields and keeps their stored values.

**Size.** M

### Client-side validation

**Why.** Errors only appear after Save. Most rules (length, required, URL prefix) could show while typing.

**Design.** Compile the same field definitions into a tiny browser validator in `cms-core` covering the declarative rules: `max`, `required`, `multiline`, `prefixes`, `min/max/integer`, options and list bounds. The server stays authoritative (it also checks media existence and custom types). The panel shows inline hints, and the Save badge shows "2 fields need attention" before anything is sent.

**Size.** S

### Undo and redo

**Why.** "I didn't mean to delete that list item" shouldn't need Discard-all.

**Design.** Every store mutation (`setSectionField`, `setItemField`, `addItem`, `moveItem`…) goes through a `command(apply, revert)` wrapper that pushes onto a bounded stack. ⌘Z / ⇧⌘Z while edit mode is on, plus toolbar buttons. Typing into one field within 800 ms coalesces into one entry.

**Size.** S

---

## Horizon 2 · Editor superpowers

### Point-to-edit

**Why.** Finding the right field in a big form is slower than clicking the text you want to change. This brings back what people loved about inline editing, without the inline editors ([D4](decisions.md#d4-one-editing-model-the-slide-out-panel)).

**Design.** A `v-cms-field` directive marks where a field renders:

```vue
<h1 v-cms-field="'title'">{{ data.title }}</h1>
```

In edit mode, hovering marked elements shows a thin highlight with the field label. Clicking one opens the section's panel, scrolls to that field, focuses it and pulses its outline. It works the other way too: focusing a field in the panel highlights where it appears on the page, scrolling it into view if needed. For list items, `v-cms-field="['images', index]"` targets a specific item, expanding it in the panel.

The directive finds its section through the same injection `CmsSection` uses, so marked elements need no page or section names.

**Size.** M

### Command palette

**Why.** Editors think in content ("the Tuesday special", "Downtown hours"), not pages.

**Design.** ⌘K in edit mode opens Nuxt UI's `UCommandPalette`, backed by a new `GET /cms/search?q=` endpoint. It searches section values and collection items across all pages, matches labels (field and section names), and returns `{ page, url, section | collection+item, field }`. Choosing a result navigates (an Inertia visit with `?edit`) and then opens the panel at the field via point-to-edit. A recently edited group comes from `cms_revisions`.

**Size.** M

### Conflict detection

**Why.** "Last save wins" silently overwrites a colleague's edit.

**Design.** Optimistic concurrency:

- Add a `version` integer to `cms_sections` and `cms_documents`, incremented on every write.
- Props carry each section's and item's version. Drafts remember the version they started from.
- Ops send `expectedVersion`. If pass 1 finds a mismatch, it returns `409`-style errors per op, with the current server value.
- The panel shows a **merge view** per conflicting field: _yours_, _theirs_, _original_ (from the revision at `expectedVersion`). Fields only one side touched merge automatically, so this is a three-way merge per field. Lists merge by item identity when items carry stable ids (see [stable list ids](#stable-list-ids)).

**Size.** M

### Stable list ids

**Why.** List items are positional. Reordering then editing looks like many changes to diffs and merges, and comments can't attach to an item.

**Design.** `f.list` items get a hidden `_id` (nanoid) assigned on create, kept through reorders, and stripped from public props unless asked for. `normalize` backfills ids for existing items deterministically (a hash of position + content) so old data stays stable.

**Size.** S

### Publishing workflow

**Why.** Bigger changes (a new menu, a holiday schedule) should be prepared in advance, reviewed, and go live at a set time.

**Design.** Promote drafts from the browser to the server as **change sets**:

```
cms_changesets(id, title, status: open|scheduled|published|discarded, publish_at, created_by)
cms_changeset_ops(changeset_id, seq, op JSON)
```

- "Save as draft" stores the current ops in a change set instead of committing them.
- **Preview** applies a change set's ops on top of live content for one request: `?preview=<signed token>`. A preview link can be shared with the owner, without an account.
- **Publish** replays the ops through the normal `commit`, so it gets the same validation (against _current_ content) and history. Conflicts surface as in [conflict detection](#conflict-detection).
- **Schedule** is a queue job at `publish_at` (an Adonis scheduler or a cron).
- **Approval** (optional): `authorize(ctx, action)` gets the action (`propose` / `publish`), so staff can propose and the owner publishes.

This keeps [D6](decisions.md#d6-drafts-live-in-the-browser): quick edits stay in the browser, and only deliberate drafts become server state.

**Size.** L

### Visual history

**Why.** "Edited: title, image" isn't enough to choose what to restore.

**Design.**

- **Field diffs:** for text, a word diff (`diff-match-patch`). Images show before and after thumbnails side by side. Lists show added, removed and moved items (needs [stable list ids](#stable-list-ids)).
- **Restore one field** instead of the whole snapshot.
- **Time machine:** `?as-of=2026-09-01` renders the whole site as it was on that date, built from revisions (sections from the latest snapshot before the date, items replayed from create/save/delete). It's read-only, and has a banner with "Restore this version of this page".

Revisions already store full snapshots, so this is mostly presentation plus an `as-of` resolver.

**Size.** M

### Presence

**Why.** Two people editing the same section should know it before they collide.

**Design.** Adonis Transmit (server-sent events) channel `cms/presence`:

- In edit mode, the client announces `{ user, page, panel }` on page visits and panel changes, with a heartbeat every 20 s.
- Section outlines show colleagues' avatars ("Maria is editing Hero"), and the panel header warns.
- **Soft locks:** opening a panel someone else has open shows a banner; there's no hard lock.
- After someone else commits, the channel pushes `{ scopes }`, and clients `router.reload({ only: [...] })`. Their drafts survive, re-based on the new saved values.

Later, field-level presence (who's typing in which field) can come from the same channel.

**Size.** M

### References

**Why.** Content points at other content: "featured special", "this event happens at Main Street", "related menu items".

**Design.**

```ts
featured: f.ref('specials'),                       // id | null
locations: f.ref('locations', { multiple: true }), // id[]
```

- **Editor:** a searchable picker over the collection's items (titles via `titleField`), showing the item's thumbnail if its schema has an image field.
- **Server:** validation checks the ids exist. Reads can expand them: `cms.pageProps('home', ctx, { expand: ['hero.featured'] })` embeds the item.
- **Integrity:** deleting an item that's referenced fails with "Used by Home › Hero", in the same spirit as media in-use protection. It reuses the walker that `mediaKeysIn` uses, generalised to `referencesIn`.

**Size.** M

### Rich text

**Why.** Paragraphs with a link or bold words (the About story, catering terms).

**Design.** `f.richText({ marks: ['bold', 'italic', 'link'], blocks: ['paragraph', 'list', 'heading3'] })`:

- **Stored as** ProseMirror JSON (structured, diffable and safe), not HTML.
- **Validated** on the server against the allowed nodes and marks, with links checked against the same URL rules as `f.link`.
- **Rendered** with `<CmsRichText :doc>`, a small renderer that walks the JSON and outputs Vue vnodes, so it never uses `v-html` and has no XSS surface.
- **Edited** with Nuxt UI's editor component (TipTap), toolbar limited to the configured marks.

**Size.** M

### SEO toolkit

**Why.** Every page needs a title, description and share image, and Google needs structured data.

**Design.**

- `f.seo()` is a group preset (`title` ≤60 chars with a live counter, `description` ≤160, `image`, `noindex`) with a Google-result preview and an Open Graph card preview in the panel.
- `<CmsHead :seo>` renders the tags through Inertia's `<Head>`.
- **Sitemap:** `cms.sitemap()` walks pages plus collections with a `route` option (`route: (item) => `/locations/${item.slug}``) and serves `/sitemap.xml`.
- **Structured data adapters** per collection (`jsonLd: (item) => ({ '@type': 'Restaurant', … })`) replace hand-written JSON-LD on pages.

**Size.** M

### Visibility rules

**Why.** Specials are tied to days ("Monday · From 4pm"). Staff hide and unhide them by hand, or the site shows a Monday special on Friday.

**Design.** A reserved, optional `_visibility` on documents and sections:

```ts
defineCollection('specials', { …, visibility: true })
// stored: { days: ['mon'], from: '16:00', until: '21:00', starts: '2026-11-01', ends: '2026-11-30' }
```

- The panel shows a compact schedule editor (day chips, time range, date range).
- The server filters items **per request** in the site's timezone (`config/cms.ts → timezone`). `collectionProps` returns items active now, and editors see all of them with "Showing Mondays 4–9pm" badges.
- **Caching:** cache entries carry the next boundary time (the next start or end of any rule) as their expiry, so nothing polls.
- Specials can also surface **"Today's special"** automatically on the home page.

**Size.** M

### Block zones

**Why.** Today a page's sections are fixed by the developer. Marketing wants to add a "Holiday hours" banner above the specials this week and remove it next week, without a deploy.

**Design.** A **zone** is a section whose value is an ordered list of _typed blocks_, each one a schema the developer defines. Editors pick and arrange blocks; developers still own every block's structure and component:

```ts
// schemas
const banner = block('Banner', { text: f.text(), tone: f.select({ options: ['info', 'warning'] }) })
const gallery = block('Gallery', { images: f.list({ image: f.image() }) })

definePage('home', {
  hero: section(…),
  extras: zone('Extra sections', { blocks: { banner, gallery }, max: 6 }),
})
```

```vue
<!-- page -->
<CmsZone name="extras" :components="{ banner: BannerBlock, gallery: GalleryBlock }" />
```

- **Stored** as `[{ _id, _type: 'banner', ...values }]` in the section's sparse data, so no new tables are needed.
- **Editor:** an "Add block" menu with previews, drag to reorder, and each block's form as a collapsible item. That's `CmsFieldList` with a type switch, reusing nearly everything.
- Combined with [visibility rules](#visibility-rules), a block can schedule itself ("show this banner Dec 20–26").

This is a page builder that can't break the design: every block is a component a developer made.

**Size.** L

---

## Horizon 3 · Platform

### AI assist

**Why.** Restaurant staff aren't copywriters. Help them write, shorten, translate and describe images, inside the schema's rules.

**Design.** Calls Claude through the Anthropic API from a new `POST /cms/assist` endpoint (the server holds the API key, and the browser never sees it):

| Action            | Input                                    | Output, always run through the field's validator                         |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| Rewrite / shorten | field value + field rules (`max`) + tone | candidate text ≤ `max`                                                   |
| Draft from notes  | "2 for 1 wings tuesdays after 5"         | title + schedule + description for a special                             |
| Alt text          | image (vision)                           | `alt` stored on the media item                                           |
| Translate         | section values + target locale           | values for [localization](#localization)                                 |
| Consistency check | all locations                            | "Middletown's phone format differs", "Elizabethtown has no Sunday hours" |

- **Schema-aware prompting:** the field's label, help text, `max` and siblings go in the prompt, and the model returns structured output matching the field type. The result is validated by the same `SchemaCompiler` before it's offered to the editor.
- **Never auto-saves:** suggestions become drafts, previewed like any edit, and stay reversible with [undo](#undo-and-redo).
- **Tone presets** live in `config/cms.ts` (`brandVoice: 'warm, family-owned, a little cheeky'`).
- **Cost guard:** per-user rate limits, and the prompt prefix is cached.

**Size.** M (rewrite and alt text) · L (all of it)

### Localization

**Design.** Fields opt in with `localized: true`. Storage becomes `{ title: { en: '…', es: '…' } }` for those fields only. The resolver picks the request locale, falling back along the configured chain (`es-MX → es → en`). The panel shows a locale switcher, and empty translations display the fallback greyed out. Collections can be localized per field the same way. Slugs can optionally be localized per locale.

**Size.** L

### Events, hooks and webhooks

**Why.** "After content changes, purge the CDN / rebuild the PDF menu / tell Slack."

**Design.**

- Emit Adonis events from `commit`: `cms:committed { ops, scopes, user }`, plus fine-grained `cms:section.saved` and `cms:document.created` / `updated` / `deleted`.
- `hooks` in config for synchronous checks: `beforeCommit(ops, ctx)` can veto a commit with an error (business rules beyond schemas, e.g. "at least one location must be open on Sundays").
- **Webhooks** configured in the admin: signed POSTs, with retries via a queue.

**Size.** S (events) · M (webhooks)

### Headless read API

**Why.** The same content should feed other screens: an in-store menu board, a kiosk, a mobile app, a Google Business Profile sync.

**Design.** An opt-in `GET /cms/api/pages/:name` and `/collections/:name` (JSON, ETag'd from [cache versions](#multi-process-cache)), with scoped read tokens. Visibility rules apply, and `expand` resolves [references](#references).

**Size.** S

### Plugin system

**Design.** Everything above should be installable as a plugin rather than core:

```ts
export default defineCmsPlugin({
  name: 'seo',
  fieldTypes: [seoType],
  routes: (router) => router.get('sitemap.xml', …),
  hooks: { afterCommit: purgeSitemapCache },
  client: () => import('@sonata/cms-seo/client'), // registers field editors, toolbar items, panels
})
```

Client plugins can add toolbar buttons, panel tabs (like "SEO" next to "Content") and field editors. Core stays small, and sites pick what they need.

**Size.** M

### Content bundles

**Why.** Starting a new site by copying a good one, moving content from staging to production, and backups an editor can understand.

**Design.** `cms:export` writes a bundle: `content.json` (sections, documents, schema hashes) plus referenced media files, zipped. `cms:import` validates the whole bundle against the _target_ site's schemas (through `commit`, so it's atomic and recorded in history), maps media keys, and reports anything that doesn't fit. A **dry run** prints a diff.

**Size.** M

### Multi-site

**Design.** One admin for several sites (a restaurant group with separate brands). A `site` column on every `cms_*` table, resolved from the host per request, with schemas shared or per site. Editors switch sites from the toolbar. Media can be shared across sites or kept per site.

**Size.** L

### Accessibility checks

**Design.** Lint content at save time and show warnings (not errors) in the panel:

- an image with no alt text
- link text like "click here"
- text over images with poor contrast (using the image's [blurhash](#media-module) average)
- headings that skip levels in rich text

`cms:doctor` reports them site-wide.

**Size.** S

---

## Horizon 4 · Restaurant pack

A vertical plugin (`@sonata/cms-restaurant`) that turns the generic CMS into a restaurant site kit. It's a separate package, so the core stays generic.

### Structured menu

Collections for `menuSections`, `menuItems` (name, description, prices by size, dietary tags, spice level, photo, 86'd flag) and `modifiers`, with [references](#references) between them.

- **PDF menu generated from data:** a `cms:committed` hook renders the menu to PDF (headless Chromium, or a PDF library using the site's fonts) and replaces `pdfs/menu.pdf` in place. The "View Menu" link never goes stale, and staff never touch InDesign.
- **Menu boards:** a `/board/:location` route renders a full-screen, auto-rotating menu for in-store TVs, live-updated through [presence](#presence)'s commit channel. When the kitchen 86's an item, every TV updates within seconds.
- **schema.org `Menu` / `MenuItem`** structured data, so Google can show dishes.

### Hours, holidays and "open now"

Promote `weeklyHours` to a first-class type with **exceptions** (`2026-12-25: closed`, `2026-12-24: 11:00–15:00`). These feed `openingHoursSpecification` with `validFrom` / `validThrough`, an "Open now · closes 9 PM" badge computed in the location's timezone, and a site-wide holiday banner that appears automatically when any location has an exception in the next 7 days.

### Ordering links health

A daily job checks every location's order, delivery and map URLs (HEAD request, redirect chains) and flags broken ones in the dashboard and in edit mode, before customers find them.

### Text-message editing

The owner texts the restaurant's number: _"86 wings at Main Street"_, _"Tuesday special is $10 pizzas"_, _"closed Monday for the storm"_. An SMS webhook passes the message to [AI assist](#ai-assist) with the site's schemas as tools. The model proposes ops (`doc.update` on the menu item, `section.save` on the banner), and the system texts back a summary: _"Hide Wings at Main Street, and show a banner 'Closed Monday 10/5'? Reply YES."_ Only on YES does it run `commit` as that user. It's the same validation, the same history and the same undo, through a different front end.

---

## Moonshots

Ideas worth writing down even if they never ship.

- **Schemas from templates.** Point a CLI at an existing Vue page. It finds hard-coded text and images, proposes a section schema with today's content as defaults, and rewrites the template to read from `data`. Retrofitting a static site becomes a reviewable pull request.
- **Content branches.** Git for content: branch the whole site ("Holiday 2026"), edit freely with full preview, then merge, with the per-field three-way merge from [conflict detection](#conflict-detection). Change sets are a single-branch special case of this.
- **Real-time co-editing.** Replace per-field drafts with a CRDT (Yjs) document per section, synced over Transmit. Two people can type in the same paragraph. Saving still produces an ordinary commit, so history and validation don't change.
- **Content tests.** `tests/content.spec.ts` asserts invariants about _live_ content: every location has Sunday hours, every special has a photo, no description mentions a price that doesn't match the menu. These run nightly against production, and failures go to Slack.
- **Offline editing on a phone.** A PWA manifest plus drafts persisted to IndexedDB (they're plain JSON already). A manager edits the specials on the train, and the commit goes out when signal returns, with conflict detection catching anything that changed meanwhile.
- **Analytics on content.** Attach click and impression counts to sections and items (privacy-friendly, aggregated server-side). Edit mode shows _"this special got 3× the clicks of the average"_, and history shows how a headline change moved conversions.
- **Design tokens as content.** A `theme` page whose fields are the Nuxt UI colours, radius and fonts, with live preview through CSS variables. Seasonal re-skins become an edit, not a deploy, and can be guard-railed with contrast checks.

---

## Suggested order

1. **[Typed content](#typed-content)**: it immediately cleans up every page template.
2. **[Media module](#media-module)** + **[Installer](#installer)**: these make site #2 possible without copying app code.
3. **[Point-to-edit](#point-to-edit)**, **[Undo](#undo-and-redo)**, **[Client-side validation](#client-side-validation)**: the biggest editor quality-of-life wins for small effort.
4. **[Visibility rules](#visibility-rules)**: specials on the right day, automatically.
5. **[Conflict detection](#conflict-detection)** + **[Stable list ids](#stable-list-ids)**: before more than two people edit regularly.
6. **[Block zones](#block-zones)**, **[References](#references)**, **[SEO toolkit](#seo-toolkit)**: flexibility for site #2 and beyond.
7. Everything else, by demand.
