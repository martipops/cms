# Client reference (`@martipops/cms-vue`)

## The plugin

```ts
import cms from '@martipops/cms-vue'

createApp(…)
  .use(ui)                          // Nuxt UI must be installed first
  .use(cms, {
    endpoint: '/admin/cms',         // where registerCmsRoutes is mounted
    mediaPicker: MediaPickerModal,  // optional; image/file fields need it
    fields: { weeklyHours: WeeklyHoursField },  // editors for custom field types
    mediaUrl: (key) => `/media/${key}`,          // optional; this is the default
    linkFolder: 'files',            // optional; media folder link fields offer (false hides it)
  })
```

It registers `CmsPage`, `CmsSection`, `CmsCollection` and `CmsToolbar` globally. With the Options API you can also import them by name for type checking.

**Tailwind:** the components are styled with Tailwind classes, so Tailwind must scan them. Import the package's CSS entry after Nuxt UI; it points Tailwind at the components wherever the package is installed:

```css
@import 'tailwindcss';
@import '@nuxt/ui';
@import '@martipops/cms-vue/tailwind.css';
```

**Media picker contract.** Props: `open`, `folder` (a field's `folder`, or `linkFolder` for links), `title`. Emits: `update:open`, and `select` with `{ key, url }`.

## Components

### `<CmsPage :content>`

Registers a page's props with the store and tells the `CmsSection`s inside which page they belong to. It renders no element of its own.

### `<CmsSection>`

| Prop           | Default         | Notes                                                              |
| -------------- | --------------- | ------------------------------------------------------------------ |
| `name`         | —               | Section key                                                        |
| `page`         | nearest CmsPage | Set it when not inside a `CmsPage` (e.g. site content in a layout) |
| `tag`          | `div`           | Wrapper element; other attributes (class, id) pass through         |
| `button-class` | `top-2 right-2` | Positions the **Edit …** button (it's `absolute`)                  |

Slot props: `data` (values with drafts applied), `edit()` (opens the panel), `editable`.

The edit-mode outline shows the section's state: dashed primary (editable), dashed warning (unsaved changes) or solid error (failed validation).

### `<CmsCollection :collection>`

| Prop           | Default         | Notes                                                       |
| -------------- | --------------- | ----------------------------------------------------------- |
| `collection`   | —               | `CollectionProps` from `cms.collectionProps()`              |
| `tag`          | `div`           |                                                             |
| `button-class` | `top-2 right-2` |                                                             |
| `no-button`    | `false`         | Hide **Edit …** when items open themselves via `edit(item)` |

Slot props: `items` (visible items with drafts applied), `all` (including hidden), `edit(item?)` (opens the panel, focused on that item), `editable`.

Each `Item` has `{ key, id, slug, hidden, data, isNew, dirty }`. Use **`key`** for `v-for` keys: new, unsaved items have a temporary string key and `id: null`.

A common pattern is clicking a card to edit it:

```vue
<CmsCollection v-slot="{ items, edit, editable }" :collection="specials" no-button>
  <div v-for="item in items" :key="item.key" @click.capture="editable && (edit(item), $event.preventDefault())">
    <SpecialCard :special="item.data" />
  </div>
</CmsCollection>
```

### `<CmsToolbar :shortcuts>`

Render it once, in the layout, for signed-in users. It hosts the panel and history modal, guards navigation when there are unsaved drafts, and restores edit mode across page visits (in `sessionStorage`; `?edit` in the URL turns it on).

`shortcuts` adds toolbar buttons for sections that aren't visible as a block on the page:

```vue
<CmsToolbar
  :shortcuts="[{ label: 'Footer', icon: 'i-lucide-panel-bottom', page: 'site', section: 'footer' }]"
/>
```

## Reading content in script

The slot `data` covers templates. For computed values (formatting, JSON-LD, nav menus), read through the store so drafts are included:

| Export                                              | Use                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `sectionValues(page, section)`                      | A section's values with drafts. The page must be registered                                                         |
| `collectionItems(name)`                             | All items with drafts, in draft order                                                                               |
| `canEditPage(page)` / `canEditCollection(name)`     | Edit mode on, and the server sent the schema                                                                        |
| `registerPage(props)` / `registerCollection(props)` | For data used outside a CmsPage/CmsCollection (e.g. the layout)                                                     |
| `openPanel(panel)`                                  | Open the panel from anywhere (`{ kind: 'section', page, section }` or `{ kind: 'collection', collection, focus? }`) |
| `mediaUrl(key)`                                     | Media key → URL (or `null`)                                                                                         |
| `editor`                                            | The raw reactive store (read-only by convention)                                                                    |

**Site-wide data pattern.** Register shared props in the layout, then derive everything from the store. Every page that shows that data then previews drafts:

```ts
// layout
watch: {
  siteContent: { immediate: true, handler: registerPage },
  locations: { immediate: true, handler: registerCollection },
}

// anywhere
const items = canEditCollection('locations') ? collectionItems('locations') : props.locations.items
```

## Generated forms

`CmsPanel` renders one `CmsField` per field. `CmsField` picks the input by type, recurses into groups (`CmsFieldGroup`) and lists (`CmsFieldList`), and shows server errors on the field they belong to.

Groups and lists render `CmsField` through a small runtime registry (`registry.field`, set when the package loads) rather than importing it. That breaks the circular import, which would otherwise make Vue's type checker infer `any` for the whole component tree.

## Behaviour notes

- **Discard** throws away every draft. **Exit** with drafts asks first.
- Navigating away with unsaved drafts asks first. Partial reloads (`only: [...]`) and non-GET visits don't count as leaving.
- After a successful save, the store clears its drafts and calls `router.reload()`, so what's on screen is exactly what was stored.
- After a failed save, nothing is stored, drafts are kept, and errors stay on their fields until each field is edited.
