# @sonata/cms-adonis

The AdonisJS side of the CMS: a provider, `config/cms.ts`, storage in `cms_*` tables, schema-to-VineJS validation, atomic commits, revision history and media-in-use tracking.

```ts
import cms from '@sonata/cms-adonis/services/main'

await cms.pageProps('home', ctx) // values (+ schema for editors)
await cms.collectionProps('locations', ctx)
await cms.findOrFail('locations', 'downtown')
await cms.commit(ops, user) // what the editor's Save calls
```

Docs: [server reference](../docs/server.md) · [installing](../docs/installing.md) · [architecture](../docs/architecture.md) · [library overview](../README.md)
