# Changelog

All three packages (`@martipops/cms-core`, `@martipops/cms-adonis`, `@martipops/cms-vue`) share one version while they live together. Breaking changes are allowed before 1.0 and are listed under **Breaking**.

## 0.1.0

First version prepared for use outside a client site, in its own repo and published privately to GitHub Packages.

**Breaking**

- Renamed from `@martipops/cms-*` to `@martipops/cms-*`.
- `mediaExists` is now `media: { exists, baseUrl? }`, and it's only required once a schema has image or file fields. Missing it fails at boot.
- `f.file()` defaults to the `files` folder (was `pdfs`). `f.image()` takes a `folder` (default `images`).
- Link fields pick from the `linkFolder` plugin option (default `files`) or the field's `folder`, instead of always `pdfs`. The button reads **Choose file**.
- `TABLES` is replaced by `cmsTables(prefix)` and `cms.tables`.
- `mediaUrl` is no longer exported from `@martipops/cms-core` (use the one from `@martipops/cms-vue`). `mediaKeysIn` / `mediaKeysInFields` take `{ baseUrl, custom }`.

**Added**

- `node ace configure @martipops/cms-adonis`: registers the provider and commands, creates `config/cms.ts` and the migration, mounts the routes, and installs the Vue plugin and Tailwind entry.
- `cms:make:page`, `cms:make:collection` and `cms:make:field` generators, which also register what they create in `config/cms.ts`.
- `@martipops/cms-vue` ships compiled (`dist/`, with type declarations) instead of `.vue` source, plus a Vite plugin, `@martipops/cms-vue/vite`, that sites add to `vite.config.ts` (the installer does).
- `tablePrefix` config.
- `cmsTablesV1` (`@martipops/cms-adonis/schema`): the tables as a versioned migration step.
- `@martipops/cms-vue/tailwind.css`, replacing a hand-written `@source` path.
- Standalone test suites for `cms-core` and `cms-adonis`.

**Fixed**

- `cms-adonis` imported types from `@vinejs/compiler`, which it didn't depend on.
- `slugify` strips accents with an explicit Unicode range.
- Builds from a fresh install outside the site: `cms-adonis` declares `luxon` and `@adonisjs/assembler` for its tests, and its `ts-morph` types follow the assembler's major version (28). `cms-vue` type-checks under newer `vue-tsc`.
