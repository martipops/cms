# Installing in a new site

About five minutes on a fresh Adonis + Inertia + Vue + Nuxt UI app: install the packages, run the installer, set who may edit.

## Prerequisites

- AdonisJS 7 with Lucid and VineJS. Auth (and Bouncer, for permissions) is how you'll decide who may edit
- Inertia + Vue 3 with Nuxt UI 4 (the Vue plugin, not the Nuxt framework)
- For image and file fields only: a media library that can answer "does this key exist?" and show a picker dialog. This is the app's job until the [media module](roadmap.md#media-module) ships. Sites without image or file fields don't need one.

## 1. Install the packages

While they live in the client site's repo, copy `packages/` and add `"workspaces": ["packages/*"]` to the app's `package.json`. Once published:

```sh
npm i @martipops/cms-core @martipops/cms-adonis @martipops/cms-vue
```

## 2. Run the installer

```sh
node ace configure @martipops/cms-adonis
```

It does the following, and skips any step that's already done:

| Step                                                                               | File                                         |
| ---------------------------------------------------------------------------------- | -------------------------------------------- |
| Registers the provider and the `cms:*` commands                                    | `adonisrc.ts`                                |
| Creates the config, with editing **off for everyone** until you set `authorize`    | `config/cms.ts`                              |
| Creates the migration (calls [`cmsTablesV1`](server.md#tables))                    | `database/migrations/*_create_cms_tables.ts` |
| Mounts the endpoints at `/admin/cms`, behind `middleware.auth()` if the app has it | `start/routes.ts`                            |
| Adds the Vite plugin (`@martipops/cms-vue/vite`)                                   | `vite.config.ts`                             |
| Installs the Vue plugin after Nuxt UI                                              | `inertia/app.ts`                             |
| Lets Tailwind see the edit-mode components                                         | `inertia/css/app.css`                        |

When a file doesn't look like the Adonis starter's (say, no `.use(ui)` in `inertia/app.ts`), it leaves that file alone and prints the line to add. The [manual steps](#manual-install) below describe each edit.

## 3. Finish by hand

1. **Who may edit.** Set `authorize` (and `user`, for history) in `config/cms.ts`:

   ```ts
   authorize: (ctx) => ctx.bouncer.allows('manageContent'),
   user: ({ auth }) => (auth.user ? { id: auth.user.id, name: auth.user.email } : null),
   ```

2. **Media** (only if you'll use image or file fields): add `media: { exists }` to `config/cms.ts`, and pass your picker to the Vue plugin with `.use(cms, { endpoint: '/admin/cms', mediaPicker: MediaPickerModal })`.
3. `node ace migration:run`
4. **The toolbar.** Render it in the layout for signed-in users: `<CmsToolbar v-if="user" />`

## Your first editable page

```sh
node ace cms:make:page home
```

This writes `app/cms/pages/home.ts` (a Hero section with a title and intro) and adds it to `pages` in `config/cms.ts`. Send it from the controller:

```ts
return ctx.inertia.render('home', { content: await cms.pageProps('home', ctx) })
```

and render it:

```vue
<CmsPage :content="content">
  <CmsSection v-slot="{ data }" name="hero"><h1>{{ data.title }}</h1></CmsSection>
</CmsPage>
```

Sign in, press **Edit page**, and the hero has an **Edit Hero** button.

The other generators work the same way:

| Command                      | Writes                                                                             | Registers in `config/cms.ts` |
| ---------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- |
| `cms:make:page <name>`       | `app/cms/pages/<name>.ts`                                                          | `pages`                      |
| `cms:make:collection <name>` | `app/cms/collections/<plural>.ts` (name, slug and description fields)              | `collections`                |
| `cms:make:field <name>`      | `app/cms/fields/<name>.ts` (validator) + `inertia/components/cms/<name>_field.vue` | `fieldTypes`                 |

A custom field's editor still needs registering with the Vue plugin (`fields: { openingHours: OpeningHoursField }`); the command prints the line.

## Docker

While the packages are workspaces, `npm ci` must see each package's `package.json`, and the production stage needs the built packages. See this repo's `Dockerfile`. This isn't needed once they're installed from a registry.

## Manual install

What the installer does, for apps it can't edit:

1. `adonisrc.ts`: add `() => import('@martipops/cms-adonis/cms_provider')` to `providers` and `() => import('@martipops/cms-adonis/commands')` to `commands`.
2. `config/cms.ts`: `export default defineConfig({ pages: [], authorize: () => false })` from `@martipops/cms-adonis`.
3. A migration whose `up()` calls `cmsTablesV1.up(this.schema)` and `down()` calls `cmsTablesV1.down(this.schema)` (from `@martipops/cms-adonis/schema`).
4. `start/routes.ts`: `router.group(() => registerCmsRoutes(router)).prefix('admin/cms').use(middleware.auth())`
5. `vite.config.ts`: `import cms from '@martipops/cms-vue/vite'` and add `cms()` to `plugins`.
6. `inertia/app.ts`: `import cms from '@martipops/cms-vue'`, then `.use(cms, { endpoint: '/admin/cms' })` after `.use(ui)`.
7. `inertia/css/app.css`: `@import '@martipops/cms-vue/tailwind.css';` after `@import '@nuxt/ui';`.

## Checklist before launch

- [ ] `authorize` returns `false` for visitors (log out and check the page source has no `"schema"`)
- [ ] The media library refuses to delete files used by content (`mediaKeysInUse()`)
- [ ] A save works against the **real** database through the HTTP endpoint, not only in tests
- [ ] `docker build .` succeeds and the migrations run on boot
