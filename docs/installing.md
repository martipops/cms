# Installing in a new site

Today this is manual: about 15 minutes on a fresh Adonis + Inertia + Vue + Nuxt UI app. The [installer](roadmap.md#installer) will automate every step marked 🤖.

## Prerequisites

- AdonisJS 7 with Lucid, VineJS, auth and (for permissions) Bouncer
- Inertia + Vue 3 with Nuxt UI 4 (the Vue plugin, not the Nuxt framework)
- A media library that can answer "does this key exist?" and show a picker dialog. This is the app's job until the [media module](roadmap.md#media-module) ships.

## Steps

**1. Install the packages.** While they live in this repo, copy `packages/` and add `"workspaces": ["packages/*"]`. Once published:

```sh
npm i @sonata/cms-core @sonata/cms-adonis @sonata/cms-vue
```

**2. 🤖 Register the provider** in `adonisrc.ts`:

```ts
providers: [/* … */ () => import('@sonata/cms-adonis/cms_provider')]
```

**3. 🤖 Create the tables.** Copy `database/migrations/*_create_cms_tables.ts` from this repo.

**4. 🤖 Create `config/cms.ts`.** Start with no pages:

```ts
export default defineConfig({
  pages: [],
  authorize: (ctx) => ctx.bouncer?.allows('manageContent') ?? false,
  user: ({ auth }) => (auth?.user ? { id: auth.user.id, name: auth.user.email } : null),
  // Only needed once a schema uses f.image or f.file
  media: {
    exists: async (key, folder) => Boolean(await Media.query().where({ key, folder }).first()),
  },
})
```

**5. 🤖 Mount the routes** in `start/routes.ts`:

```ts
router
  .group(() => registerCmsRoutes(router))
  .prefix('admin/cms')
  .use(middleware.auth())
```

**6. 🤖 Install the Vue plugin** in `inertia/app.ts`, after Nuxt UI:

```ts
.use(cms, { endpoint: '/admin/cms', mediaPicker: MediaPickerModal })
```

**7. 🤖 Let Tailwind see the components** (`inertia/css/app.css`):

```css
@source '../../packages/cms-vue/src';
```

**8. Add the toolbar** to the layout for signed-in users:

```vue
<CmsToolbar v-if="user" />
```

**9. Docker.** `npm ci` must see the workspace `package.json` files, and the production stage needs the built packages. See this repo's `Dockerfile`. (Not needed once installed from a registry.)

## Your first editable section

```ts
// app/cms/pages/home.ts
export default definePage('home', {
  hero: section('Hero', { title: f.text({ default: 'Hello', max: 80 }) }),
})
```

Add it to `pages` in `config/cms.ts`, then:

```ts
return ctx.inertia.render('home', { content: await cms.pageProps('home', ctx) })
```

```vue
<CmsPage :content="content">
  <CmsSection v-slot="{ data }" name="hero"><h1>{{ data.title }}</h1></CmsSection>
</CmsPage>
```

Sign in, press **Edit page**, and the hero has an **Edit Hero** button.

## Checklist before launch

- [ ] `authorize` returns `false` for visitors (log out and check the page source has no `"schema"`)
- [ ] The media library refuses to delete files used by content (`mediaKeysInUse()`)
- [ ] A save works against the **real** database through the HTTP endpoint, not only in tests
- [ ] `docker build .` succeeds and the migrations run on boot
