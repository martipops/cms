import { createInertiaApp } from '@inertiajs/vue3'
import ui from '@nuxt/ui/vue-plugin'
import { createApp, h } from 'vue'

createInertiaApp({
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(App, props) })
      .use(plugin)
      .use(ui)
      .mount(el)
  },
})
