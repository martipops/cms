<script lang="ts">
import { defineComponent } from 'vue'
import type { CollectionSchema, JsonValue } from '@sonata/cms-core'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCollapsible from '@nuxt/ui/components/Collapsible.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import {
  addItem,
  collectionItems,
  editor,
  itemKey,
  moveItem,
  removeItem,
  setItemField,
  setItemHidden,
  type Item,
} from '../store.js'
import CmsField from './cms_field.vue'
import { errorsUnder } from '../errors.js'

/**
 * Panel body for a collection: every item as a collapsible form, plus add,
 * hide, delete and reorder where the collection allows it.
 */
export default defineComponent({
  components: { CmsField, UBadge, UButton, UCollapsible, UIcon, USwitch },
  props: {
    collection: {
      type: String,
      required: true,
    },
    /** Item to expand and scroll to */
    focus: {
      type: [Number, String],
      default: undefined,
    },
  },
  data() {
    return {
      expanded: {} as Record<string, boolean>,
      confirmingDelete: null as number | string | null,
    }
  },
  computed: {
    schema(): CollectionSchema {
      return editor.collections[this.collection].schema!
    },
    items(): Item[] {
      return collectionItems(this.collection)
    },
  },
  watch: {
    focus: {
      immediate: true,
      handler(focus?: number | string) {
        if (focus !== undefined) this.reveal(focus)
      },
    },
  },
  methods: {
    reveal(key: number | string) {
      this.expanded[String(key)] = true
      this.$nextTick(() => {
        document
          .getElementById(`cms-item-${this.collection}-${key}`)
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      })
    },
    title(item: Item) {
      const value = item.data[this.schema.titleField]
      return typeof value === 'string' && value.trim()
        ? value
        : `New ${this.schema.label.toLowerCase()}`
    },
    errors(item: Item) {
      return editor.errors[itemKey(this.collection, item.key)] ?? {}
    },
    hasErrors(item: Item) {
      return Object.keys(this.errors(item)).length > 0
    },
    fieldErrors(item: Item, key: string) {
      return errorsUnder(this.errors(item), key)
    },
    update(item: Item, key: string, value: JsonValue) {
      setItemField(this.collection, item.key, key, value)
    },
    add() {
      const ref = addItem(this.collection)
      if (ref) this.reveal(ref)
    },
    remove(item: Item) {
      if (this.confirmingDelete !== item.key) {
        this.confirmingDelete = item.key
        return
      }
      this.confirmingDelete = null
      removeItem(this.collection, item.key)
    },
    move(item: Item, offset: -1 | 1) {
      moveItem(this.collection, item.key, offset)
    },
    setShown(item: Item, shown: boolean) {
      setItemHidden(this.collection, item.key, !shown)
    },
    history(item: Item) {
      if (item.id !== null) {
        editor.history = { kind: 'item', collection: this.collection, id: item.id }
      }
    },
  },
})
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="(item, index) in items"
      :id="`cms-item-${collection}-${item.key}`"
      :key="item.key"
      class="scroll-mt-4 rounded-lg border"
      :class="[
        hasErrors(item) ? 'border-error' : item.dirty ? 'border-warning' : 'border-default',
        item.hidden ? 'opacity-70' : '',
      ]"
    >
      <UCollapsible v-model:open="expanded[String(item.key)]">
        <div class="flex items-center gap-1 p-2">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left">
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 shrink-0 text-muted transition-transform"
              :class="expanded[String(item.key)] ? 'rotate-90' : ''"
            />
            <span class="truncate text-sm font-medium">{{ title(item) }}</span>
            <UBadge v-if="item.isNew" label="New" color="primary" variant="subtle" size="sm" />
            <UBadge
              v-else-if="item.hidden"
              label="Hidden"
              color="neutral"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="hasErrors(item)"
              label="Fix errors"
              color="error"
              variant="subtle"
              size="sm"
            />
          </button>
          <template v-if="schema.allow.reorder">
            <UButton
              icon="i-lucide-arrow-up"
              aria-label="Move up"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="index === 0"
              @click.stop="move(item, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              aria-label="Move down"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="index === items.length - 1"
              @click.stop="move(item, 1)"
            />
          </template>
        </div>

        <template #content>
          <div class="space-y-4 border-t border-default p-3">
            <CmsField
              v-for="(field, key) in schema.fields"
              :key="key"
              :field="field"
              :model-value="item.data[key]"
              :errors="fieldErrors(item, String(key))"
              @update:model-value="(value: JsonValue) => update(item, String(key), value)"
            />

            <div class="flex flex-wrap items-center gap-2 border-t border-default pt-3">
              <USwitch
                v-if="schema.allow.hide && !item.isNew"
                :model-value="!item.hidden"
                label="Shown on the site"
                @update:model-value="(shown) => setShown(item, shown)"
              />
              <UButton
                v-if="!item.isNew"
                label="History"
                icon="i-lucide-history"
                color="neutral"
                variant="ghost"
                size="sm"
                class="ml-auto"
                @click="history(item)"
              />
              <UButton
                v-if="schema.allow.delete || item.isNew"
                :label="confirmingDelete === item.key ? 'Click again to delete' : 'Delete'"
                icon="i-lucide-trash-2"
                color="error"
                :variant="confirmingDelete === item.key ? 'solid' : 'ghost'"
                size="sm"
                :class="item.isNew ? 'ml-auto' : ''"
                @click="remove(item)"
              />
            </div>
          </div>
        </template>
      </UCollapsible>
    </div>

    <p v-if="!items.length" class="py-6 text-center text-sm text-muted">
      No {{ schema.labelPlural.toLowerCase() }} yet.
    </p>

    <UButton
      v-if="schema.allow.create"
      :label="`Add ${schema.label.toLowerCase()}`"
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      block
      @click="add"
    />
  </div>
</template>
