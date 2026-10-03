# Changelog

All three packages (`@sonata/cms-core`, `@sonata/cms-adonis`, `@sonata/cms-vue`) share one version while they live together. Breaking changes are allowed before 1.0 and are listed under **Breaking**.

## 0.1.0

First version prepared for use outside a client site.

**Breaking**

- Renamed from `@martipops/cms-*` to `@sonata/cms-*`.
- `mediaExists` is now `media: { exists, baseUrl? }`, and it's only required once a schema has image or file fields. Missing it fails at boot.
- `f.file()` defaults to the `files` folder (was `pdfs`). `f.image()` takes a `folder` (default `images`).
- Link fields pick from the `linkFolder` plugin option (default `files`) or the field's `folder`, instead of always `pdfs`. The button reads **Choose file**.
- `TABLES` is replaced by `cmsTables(prefix)` and `cms.tables`.
- `mediaUrl` is no longer exported from `@sonata/cms-core` (use the one from `@sonata/cms-vue`). `mediaKeysIn` / `mediaKeysInFields` take `{ baseUrl, custom }`.

**Added**

- `tablePrefix` config.
- `cmsTablesV1` (`@sonata/cms-adonis/schema`): the tables as a versioned migration step.
- `@sonata/cms-vue/tailwind.css`, replacing a hand-written `@source` path.
- Standalone test suites for `cms-core` and `cms-adonis`.

**Fixed**

- `cms-adonis` imported types from `@vinejs/compiler`, which it didn't depend on.
- `slugify` strips accents with an explicit Unicode range.
