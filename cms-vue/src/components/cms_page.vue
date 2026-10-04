<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { PageProps } from '@martipops/cms-core'
import { registerPage } from '../store.js'

/**
 * Provides a page's content (from `cms.pageProps()` on the server) to the
 * <CmsSection>s inside it. Renders no element of its own.
 *
 *   <CmsPage :content="content">
 *     <CmsSection v-slot="{ data }" name="hero">…</CmsSection>
 *   </CmsPage>
 */
export default defineComponent({
  provide() {
    return { cmsPage: () => this.content.name }
  },
  props: {
    content: {
      type: Object as PropType<PageProps>,
      required: true,
    },
  },
  watch: {
    content: {
      immediate: true,
      handler(content: PageProps) {
        registerPage(content)
      },
    },
  },
  render() {
    return this.$slots.default?.()
  },
})
</script>
