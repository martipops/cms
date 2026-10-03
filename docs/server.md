# Server reference (`@sonata/cms-adonis`)

## Setup

| Piece     | Where                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider  | `adonisrc.ts` → `() => import('@sonata/cms-adonis/cms_provider')`                                                                            |
| Config    | `config/cms.ts` (below)                                                                                                                      |
| Routes    | `router.group(() => registerCmsRoutes(router)).prefix('admin/cms').use(middleware.auth())`                                                   |
| Migration | Creates `cms_sections`, `cms_documents`, `cms_revisions`, `cms_seeds`, or the same with your `tablePrefix` (see [installing](installing.md)) |
| Service   | `import cms from '@sonata/cms-adonis/services/main'`                                                                                         |

## `config/cms.ts`

```ts
import { defineConfig } from '@sonata/cms-adonis'

export default defineConfig({
  pages: [site, home, about], // definePage results
  collections: [locations, specials], // defineCollection results
  fieldTypes: [weeklyHoursType], // defineFieldType results

  authorize: (ctx) => ctx.bouncer?.allows('manageContent') ?? false,
  user: ({ auth }) => (auth?.user ? { id: auth.user.id, name: auth.user.fullName } : null),
  media: {
    exists: async (key, folder) => Boolean(await Media.query().where({ key, folder }).first()),
    baseUrl: '/media/', // optional; this is the default
  },
})
```

| Option          | Required | Purpose                                                                                                              |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `pages`         |          | Editable pages and site-wide scopes                                                                                  |
| `collections`   |          | Editable collections                                                                                                 |
| `fieldTypes`    |          | Custom field types used by `f.custom`                                                                                |
| `authorize`     | ✓        | Whether a request may edit. It gates the endpoints and whether schemas are sent. Memoized per request                |
| `user`          |          | Who to record on revisions (`{ id, name }`). The name is copied into the revision, so history survives deleted users |
| `media`         |          | The media library. Required as soon as a schema has `f.image` or `f.file` (checked at boot)                          |
| `media.exists`  |          | `(key, folder) => Promise<boolean>`. Validates `f.image` / `f.file` values                                           |
| `media.baseUrl` |          | Public base URL of media files, default `/media/`. Links and URLs under it count as uses of that file                |
| `tablePrefix`   |          | Prefix of the CMS tables, default `cms_`. Must match the migration. `cmsTables(prefix)` gives the names              |

All schemas are compiled when the service boots, so a typo in a schema or an unknown custom type fails at startup.

## The `Cms` service

### Reading

| Method                               | Returns                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `pageProps(name, ctx)`               | `PageProps`: resolved values, plus `schema` for editors                          |
| `collectionProps<V>(name, ctx)`      | `CollectionProps<V>`: items (hidden ones for editors), plus `schema` for editors |
| `sections(name)`                     | Resolved values per section (cached)                                             |
| `items<V>(name, { includeHidden? })` | `Document<V>[]` in display order                                                 |
| `find<V>(name, slug)`                | A visible item, or `null`                                                        |
| `findOrFail<V>(name, slug)`          | A visible item, or a 404 exception                                               |
| `canEdit(ctx)`                       | `authorize(ctx)`, memoized per request                                           |
| `page(name)` / `collection(name)`    | The definition (404 exception if unknown)                                        |

```ts
// A controller
const location = await cms.findOrFail<LocationData>('locations', params.slug)

// A validator rule
if (!(await cms.find('locations', value)))
  field.report('Choose one of our locations', 'location', field)
```

### Writing

| Method              | Notes                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `commit(ops, user)` | Applies ops atomically. Throws `CommitValidationError` (`.errors`) on any invalid op. See [protocol.md](protocol.md) |
| `history(target)`   | Last 25 revisions of `{ page, section }` or `{ collection, id }`                                                     |

Server code can call `commit` directly, for imports, scripts or tests, and gets the same validation and history as the editor.

### Media

| Method               | Returns                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `defaultMediaKeys()` | Keys referenced by schema defaults and collection `initial` data (static) |
| `mediaKeysInUse()`   | The above plus every key in saved sections and documents                  |

The app's media library calls these to refuse deleting files the site uses.

### Housekeeping

`clearCache()` drops cached sections and documents and the "already seeded" memo. Tests call it in `group.each.setup`, because rolled-back transactions would otherwise leave stale cache entries.

## HTTP endpoints

Registered by `registerCmsRoutes(router)`. They check `authorize` themselves, so they're safe even if a group's middleware is misconfigured.

| Route                         | Name          | Response                                              |
| ----------------------------- | ------------- | ----------------------------------------------------- |
| `POST commit`                 | `cms.commit`  | `200 { created }` · `422 { message, errors }` · `403` |
| `GET history?page=&section=`  | `cms.history` | `200 { data: Revision[] }`                            |
| `GET history?collection=&id=` | `cms.history` | same                                                  |

The commit endpoint parses the **raw JSON body**. Adonis's bodyparser setting `convertEmptyStringsToNull` would otherwise turn a deliberately cleared text field into `null`.

## Tables

| Table           | Key columns                                                                                                                | Notes                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `cms_sections`  | `page`, `section` (unique together), `data` JSON                                                                           | Only edited fields. The row is deleted when all fields are reset |
| `cms_documents` | `collection`, `slug` (unique together), `data` JSON, `sort_order`, `hidden`                                                | Index on (`collection`, `sort_order`)                            |
| `cms_revisions` | `kind` (`section`/`document`), `target` (`home.hero` / `locations:12`), `action`, `data`, `hidden`, `user_id`, `user_name` | Append-only. Index on (`kind`, `target`)                         |
| `cms_seeds`     | `collection` (primary key), `seeded_at`                                                                                    | Present = `initial` already inserted                             |

User columns are plain strings with no foreign key, so the package makes no assumption about the app's users table.

## Testing

```ts
import cms from '@sonata/cms-adonis/services/main'
import { Cms, CommitValidationError, defineConfig } from '@sonata/cms-adonis'

test.group('…', (group) => {
  group.each.setup(() => {
    cms.clearCache()
    return testUtils.db().withGlobalTransaction()
  })
})
```

- To test the library in isolation, build a `new Cms(defineConfig({ … }))` with throwaway schemas (see `tests/functional/cms.spec.ts`).
- Tests share the dev SQLite file. Don't assert absolute row counts in shared tables; scope assertions to what the test created.
- ⚠️ A global transaction hides connection problems, because everything runs on one connection. Code that opens its own connection inside a transaction can pass the tests and deadlock in production. The two-pass commit exists because of exactly this. Hit the real endpoint before you trust a change to the write path.
