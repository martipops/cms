<script lang="ts">
import { defineComponent } from 'vue'
import type { JsonValue, Section } from '@martipops/cms-core'
import UButton from '@nuxt/ui/components/Button.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'
import {
  editor,
  resetSection,
  sectionKey,
  sectionSchema,
  sectionValues,
  setSectionField,
} from '../store.js'
import CmsField from './cms_field.vue'
import CmsCollectionEditor from './cms_collection_editor.vue'
import { errorsUnder } from '../errors.js'

/**
 * The slide-out editor. Shows the form for whatever `editor.panel` points
 * at: a section, or a collection's list of items. Every change is a draft
 * previewed on the page; the toolbar saves them.
 */
export default defineComponent({
  components: { CmsCollectionEditor, CmsField, UButton, USlideover },
  data() {
    return { editor }
  },
  computed: {
    open: {
      get(): boolean {
        return editor.panel !== null
      },
      set(open: boolean) {
        if (!open) editor.panel = null
      },
    },
    section(): { page: string; name: string; schema: Section } | null {
      const panel = editor.panel
      if (panel?.kind !== 'section') return null
      const schema = sectionSchema(panel.page, panel.section)
      return schema ? { page: panel.page, name: panel.section, schema } : null
    },
    values(): Record<string, JsonValue> {
      return this.section ? sectionValues(this.section.page, this.section.name) : {}
    },
    errors(): Record<string, string> {
      return this.section
        ? (editor.errors[sectionKey(this.section.page, this.section.name)] ?? {})
        : {}
    },
    collection(): string | null {
      const panel = editor.panel
      return panel?.kind === 'collection' && editor.collections[panel.collection]?.schema
        ? panel.collection
        : null
    },
    focus() {
      const panel = editor.panel
      return panel?.kind === 'collection' ? panel.focus : undefined
    },
    title(): string {
      if (this.section) return this.section.schema.label
      if (this.collection) return editor.collections[this.collection].schema!.labelPlural
      return ''
    },
    description(): string {
      return (
        this.section?.schema.description ??
        'Changes preview on the page. Save them from the toolbar.'
      )
    },
  },
  methods: {
    fieldErrors(key: string) {
      return errorsUnder(this.errors, key)
    },
    update(key: string, value: JsonValue) {
      if (this.section) setSectionField(this.section.page, this.section.name, key, value)
    },
    reset() {
      if (this.section) resetSection(this.section.page, this.section.name)
    },
    history() {
      if (this.section) {
        editor.history = { kind: 'section', page: this.section.page, section: this.section.name }
      }
    },
  },
})
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="title"
    :description="description"
    :overlay="false"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <div v-if="section" class="space-y-4">
        <CmsField
          v-for="(field, key) in section.schema.fields"
          :key="key"
          :field="field"
          :model-value="values[key]"
          :errors="fieldErrors(String(key))"
          @update:model-value="(value: JsonValue) => update(String(key), value)"
        />
      </div>
      <CmsCollectionEditor v-else-if="collection" :collection="collection" :focus="focus" />
    </template>

    <template #footer>
      <div class="flex w-full items-center gap-2">
        <template v-if="section">
          <UButton
            label="History"
            icon="i-lucide-history"
            color="neutral"
            variant="ghost"
            @click="history"
          />
          <UButton
            label="Reset to original"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="ghost"
            @click="reset"
          />
        </template>
        <UButton label="Done" class="ml-auto" @click="open = false" />
      </div>
    </template>
  </USlideover>
</template>
