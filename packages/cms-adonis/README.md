# @martipops/cms-adonis

The AdonisJS side of the CMS: a provider, `config/cms.ts`, storage in `cms_*` tables, schema-to-VineJS validation, atomic commits, revision history and media-in-use tracking.

```ts
import cms from '@martipops/cms-adonis/services/main'

await cms.pageProps('home', ctx) // values (+ schema for editors)
await cms.collectionProps('locations', ctx)
await cms.findOrFail('locations', 'downtown')
await cms.commit(ops, user) // what the editor's Save calls
```

Docs: [server reference](https://github.com/martipops/cms/blob/main/docs/server.md) · [installing](https://github.com/martipops/cms/blob/main/docs/installing.md) · [architecture](https://github.com/martipops/cms/blob/main/docs/architecture.md) · [library overview](https://github.com/martipops/cms#readme)
