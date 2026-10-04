# Decisions

Short records of choices that shape the library: what was decided, why, and what was given up. Add new ones at the end, and never rewrite old ones; supersede them instead.

---

### D1. Schemas in code, content in the database

**Decision.** Structure, defaults and validation rules live in TypeScript schemas, versioned with the code. The database holds only what editors changed.

**Why.** Developers review structure changes in pull requests, and a site renders fully with an empty database (tests, previews, new installs). Defaults can improve over time without overwriting staff edits.

**Trade-off.** Editors can't create new _kinds_ of content; that's a developer task. The [block zones](roadmap.md#block-zones) roadmap item loosens this for page layout without giving up typed schemas.

---

### D2. Sections store sparse edits

**Decision.** `cms_sections.data` holds only edited fields. Reset deletes the key.

**Why.** "Reset to default" is exact, and a changed default reaches everything that wasn't edited.

**Rejected.** Storing every field (the default would be frozen at first save), and one row per field (the previous design: many rows, and no atomic section-level history).

---

### D3. Collections are JSON documents by default

**Decision.** Every collection item is a row in one `cms_documents` table, with its fields in a JSON column.

**Why.** A new collection needs no migration, model or controller. Validation comes from the schema, not the table, and marketing-site collections are small (tens of items) and read whole.

**Trade-off.** No SQL-level constraints, indexes or joins on fields. When that matters (relations, large tables, reporting), use a [model-backed collection](roadmap.md#model-backed-collections).

---

### D4. One editing model: the slide-out panel

**Decision.** Everything is edited in a generated form in a side panel. The page previews live. There's no inline `contenteditable` editing.

**Why.** One consistent interaction for staff. It works the same for text, images, lists, hours and anything custom. The library doesn't need fragile inline editors, and designers can use any component, because the page only _renders_ values.

**Rejected.** The first version's inline text editing. It felt magical for headlines, but every other field type needed a panel anyway, and it fought with animations and component slots.

**Later.** [Point-to-edit](roadmap.md#point-to-edit) brings back the "click the thing you want to change" feel without inline editing.

---

### D5. One commit per Save, validated before the transaction

**Decision.** All drafts go to the server as one ordered list of ops. Pass 1 validates everything outside a transaction, and pass 2 writes everything inside one.

**Why.** Atomic saves, and every error at once. Validators that touch the database (media existence) can't deadlock SQLite's single connection or hold Postgres locks.

**History.** The first implementation validated inside the transaction. The tests passed (they share one connection) and the real endpoint hung. See the testing warning in [server.md](server.md#testing).

---

### D6. Drafts live in the browser

**Decision.** Unsaved changes exist only in the editor's tab, in a reactive store, until Save.

**Why.** Zero server state for half-finished edits. Live preview is just "render through the store", and Discard is just "clear the store".

**Trade-off.** Drafts are lost if the tab closes (the navigation guard warns first), and other editors can't see them. [Server drafts](roadmap.md#publishing-workflow) and [presence](roadmap.md#presence) address this.

---

### D7. Schemas are only sent to editors

**Decision.** Visitors get resolved values. Field definitions go only to requests that pass `authorize`.

**Why.** Smaller payloads, and nothing about the editing surface leaks.

---

### D8. Resets are a separate list, not `null`

**Decision.** `section.save` has `changes` and `reset`. `null` in `changes` is a value.

**Why.** Image and number fields legitimately hold `null` ("no image"). The first protocol used `null` to mean reset, which made "remove this image" impossible when the default had one.

---

### D9. The commit endpoint parses the raw body

**Decision.** `CmsController.commit` reads `request.raw()` instead of the parsed body.

**Why.** Adonis's bodyparser converts `""` to `null` app-wide. For a CMS, clearing a text field is a real edit, and the converted `null` failed validation.

---

### D10. `cms-vue` ships compiled, with a Vite plugin, and injects app dependencies

**Decision.** The Vue package is built to `dist/` (Vite library mode, `vue-tsc` declarations), with Vue, Inertia, Nuxt UI and `cms-core` left as imports. Sites add `@martipops/cms-vue/vite` to their Vite plugins and import `@martipops/cms-vue/tailwind.css`. The media picker and custom field editors come in as plugin options.

**Why.** Shipping `.vue` + `.ts` source made sites type-check the package with their own `tsconfig`, and it only worked while the package was a workspace symlink. The components import Nuxt UI's `.vue` files directly (D11), which only the site's Vite can compile, so the plugin keeps the package out of dependency pre-bundling and bundles it into SSR builds. The package never imports app code, and the site's Tailwind and Nuxt UI theme still apply.

**Trade-off.** One more line in `vite.config.ts` (the installer adds it), and a build step when working on the package (`npm run dev` watches it).

---

### D11. Explicit Nuxt UI imports inside the package

**Decision.** Package components import `@nuxt/ui/components/*.vue` explicitly instead of relying on auto-import.

**Why.** Auto-import is configured per app and skips `node_modules`. Explicit imports work wherever the package is installed.

---

### D12. Recursive field components via a runtime registry

**Decision.** `CmsFieldList` and `CmsFieldGroup` render `CmsField` through `registry.field`, set when the package loads, instead of importing it.

**Why.** The circular import made `vue-tsc` infer `any` for the whole component (even through `defineAsyncComponent`, because `import()` still resolves the type).

---

### D13. Seed data goes through `cms_seeds`, not seeders

**Decision.** Collection `initial` items are inserted the first time the collection is read, and recorded in `cms_seeds`.

**Why.** This app runs seeders on every boot, and a seeder would resurrect items staff deleted. Migrations insert data once too, but they don't belong in a reusable package's schema definitions.
