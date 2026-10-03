<script lang="ts">
import { defineComponent, type SlotsType } from 'vue'
import type { JsonValue } from '@sonata/cms-core'
import UButton from '@nuxt/ui/components/Button.vue'
import {
  canEditPage,
  editor,
  openPanel,
  sectionDirty,
  sectionKey,
  sectionSchema,
  sectionValues,
} from '../store.js'

/**
 * One editable section of a page. The page renders it however it likes
 * from `data`; in edit mode it's outlined and gets an "Edit" button that
 * opens its form in the side panel. Edits preview live.
 *
 *   <CmsSection v-slot="{ data }" name="hero" tag="section">
 *     <h1>{{ data.title }}</h1>
 *   </CmsSection>
 */
export default defineComponent({
  components: { UButton },
  inject: {
    cmsPage: { from: 'cmsPage', default: null },
  },
  inheritAttrs: false,
  props: {
    name: {
      type: String,
      required: true,
    },
    /** Page name, when not inside a <CmsPage> (e.g. site-wide content in a layout) */
    page: {
      type: String,
      default: undefined,
    },
    tag: {
      type: String,
      default: 'div',
    },
    /** Where the edit button sits */
    buttonClass: {
      type: String,
      default: 'top-2 right-2',
    },
  },
  slots: Object as SlotsType<{
    default: { data: Record<string, JsonValue>; edit: () => void; editable: boolean }
  }>,
  computed: {
    pageName(): string {
      const name = this.page ?? (this.cmsPage as (() => string) | null)?.()
      if (!name)
        throw new Error(`<CmsSection name="${this.name}"> needs a <CmsPage> or a page prop`)
      return name
    },
    data(): Record<string, JsonValue> {
      return sectionValues(this.pageName, this.name)
    },
    label(): string {
      return sectionSchema(this.pageName, this.name)?.label ?? this.name
    },
    editable(): boolean {
      return canEditPage(this.pageName) && Boolean(sectionSchema(this.pageName, this.name))
    },
    dirty(): boolean {
      return sectionDirty(this.pageName, this.name)
    },
    hasErrors(): boolean {
      const errors = editor.errors[sectionKey(this.pageName, this.name)]
      return Boolean(errors && Object.keys(errors).length)
    },
  },
  methods: {
    edit() {
      openPanel({ kind: 'section', page: this.pageName, section: this.name })
    },
  },
})
</script>

<template>
  <component
    :is="tag"
    v-bind="$attrs"
    :class="
      editable
        ? [
            'relative outline-2 outline-offset-2',
            hasErrors
              ? 'outline-solid outline-error'
              : dirty
                ? 'outline-dashed outline-warning'
                : 'outline-dashed outline-primary/40 hover:outline-primary',
          ]
        : undefined
    "
  >
    <slot :data="data" :edit="edit" :editable="editable" />

    <UButton
      v-if="editable"
      :label="`Edit ${label}`"
      icon="i-lucide-pencil"
      color="neutral"
      variant="solid"
      size="sm"
      class="absolute z-30 shadow-lg"
      :class="buttonClass"
      @click.prevent.stop="edit"
    />
  </component>
</template>
