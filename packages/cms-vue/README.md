# @martipops/cms-vue

Edit mode for Inertia + Vue sites built with Nuxt UI. Sections and collections render with live drafts, slide-out forms are generated from schemas, and one toolbar saves everything in a single commit.

```vue
<CmsPage :content="content">
  <CmsSection v-slot="{ data }" name="hero"><h1>{{ data.title }}</h1></CmsSection>
  <CmsCollection v-slot="{ items, edit }" :collection="specials">…</CmsCollection>
</CmsPage>
<CmsToolbar v-if="user" />
```

Sites add its Vite plugin (`import cms from '@martipops/cms-vue/vite'`, then `cms()` in `plugins`) and its Tailwind entry (`@import '@martipops/cms-vue/tailwind.css'`). `node ace configure @martipops/cms-adonis` does both.

Docs: [client reference](https://github.com/martipops/cms/blob/main/docs/client.md) · [architecture](https://github.com/martipops/cms/blob/main/docs/architecture.md) · [library overview](https://github.com/martipops/cms#readme)
