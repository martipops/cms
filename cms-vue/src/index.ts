import type { App } from 'vue'
import { configure, registry, type CmsVueOptions } from './options.js'
import CmsPage from './components/cms_page.vue'
import CmsSection from './components/cms_section.vue'
import CmsCollection from './components/cms_collection.vue'
import CmsToolbar from './components/cms_toolbar.vue'
import CmsField from './components/cms_field.vue'

registry.field = CmsField

/**
 * Edit mode for Inertia + Vue + Nuxt UI sites.
 *
 *   createApp(…).use(ui).use(cms, { endpoint: '/admin/cms', mediaPicker: MediaPickerModal })
 */
export default {
  install(app: App, input: CmsVueOptions) {
    configure(input)
    app.component('CmsPage', CmsPage)
    app.component('CmsSection', CmsSection)
    app.component('CmsCollection', CmsCollection)
    app.component('CmsToolbar', CmsToolbar)
  },
}

export { CmsPage, CmsSection, CmsCollection, CmsToolbar, CmsField }
export type { CmsVueOptions }
export {
  editor,
  sectionValues,
  collectionItems,
  canEditPage,
  canEditCollection,
  openPanel,
  registerPage,
  registerCollection,
  type Item,
  type Panel,
} from './store.js'
