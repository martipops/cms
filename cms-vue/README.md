# @martipops/cms-vue

Edit mode for Inertia + Vue sites built with Nuxt UI. Sections and collections render with live drafts, slide-out forms are generated from schemas, and one toolbar saves everything in a single commit.

```vue
<CmsPage :content="content">
  <CmsSection v-slot="{ data }" name="hero"><h1>{{ data.title }}</h1></CmsSection>
  <CmsCollection v-slot="{ items, edit }" :collection="specials">…</CmsCollection>
</CmsPage>
<CmsToolbar v-if="user" />
```

This package ships `.vue` source. Add `@source` for it in your Tailwind CSS.

Docs: [client reference](../docs/client.md) · [architecture](../docs/architecture.md) · [library overview](../README.md)
