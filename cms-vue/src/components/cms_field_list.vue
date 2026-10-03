<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { defaultsOf, type JsonValue, type ListField } from '@sonata/cms-core'
import { registry } from '../options.js'
import UButton from '@nuxt/ui/components/Button.vue'
import UCollapsible from '@nuxt/ui/components/Collapsible.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { errorsUnder } from '../errors.js'

type Item = Record<string, JsonValue>

/**
 * Editor for a list field: items as collapsible forms, with add, remove and
 * reorder. Items with a single field are edited inline instead.
 */
export default defineComponent({
  components: {
    UButton,
    UCollapsible,
    UIcon,
  },
  props: {
    field: {
      type: Object as PropType<ListField>,
      required: true,
    },
    modelValue: {
      type: Array as PropType<Item[]>,
      required: true,
    },
    errors: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
  },
  emits: {
    'update:modelValue': (_value: Item[]) => true,
  },
  data() {
    return {
      /** Which items are expanded, by index */
      expanded: [] as boolean[],
    }
  },
  computed: {
    fieldComponent() {
      return registry.field
    },
    keys(): string[] {
      return Object.keys(this.field.item)
    },
    inline(): boolean {
      const [only] = Object.values(this.field.item)
      return this.keys.length === 1 && only.type !== 'group' && only.type !== 'list'
    },
    titleKey(): string | undefined {
      return this.field.itemTitle ?? this.keys.find((key) => this.field.item[key].type === 'text')
    },
  },
  methods: {
    title(item: Item, index: number) {
      const value = this.titleKey ? item[this.titleKey] : null
      return typeof value === 'string' && value.trim() ? value : `Item ${index + 1}`
    },
    hasErrors(index: number) {
      return Object.keys(this.errors).some((path) => path.startsWith(`${index}.`))
    },
    itemErrors(index: number, key: string) {
      return errorsUnder(this.errors, `${index}.${key}`)
    },
    update(index: number, key: string, value: JsonValue) {
      this.$emit(
        'update:modelValue',
        this.modelValue.map((item, i) => (i === index ? { ...item, [key]: value } : item))
      )
    },
    move(index: number, offset: -1 | 1) {
      const items = [...this.modelValue]
      ;[items[index], items[index + offset]] = [items[index + offset], items[index]]
      ;[this.expanded[index], this.expanded[index + offset]] = [
        this.expanded[index + offset],
        this.expanded[index],
      ]
      this.$emit('update:modelValue', items)
    },
    remove(index: number) {
      this.expanded.splice(index, 1)
      this.$emit(
        'update:modelValue',
        this.modelValue.filter((_, i) => i !== index)
      )
    },
    add() {
      this.expanded[this.modelValue.length] = true
      this.$emit('update:modelValue', [...this.modelValue, defaultsOf(this.field.item)])
    },
  },
})
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="(item, index) in modelValue"
      :key="index"
      class="rounded-lg border bg-elevated/40"
      :class="hasErrors(index) ? 'border-error' : 'border-default'"
    >
      <div v-if="inline" class="flex items-start gap-1 p-2">
        <component
          :is="fieldComponent"
          :field="field.item[keys[0]]"
          :model-value="item[keys[0]]"
          :errors="itemErrors(index, keys[0])"
          hide-label
          class="flex-1"
          @update:model-value="(value: JsonValue) => update(index, keys[0], value)"
        />
        <div class="flex shrink-0">
          <UButton
            icon="i-lucide-arrow-up"
            aria-label="Move up"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="index === 0"
            @click="move(index, -1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            aria-label="Move down"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="index === modelValue.length - 1"
            @click="move(index, 1)"
          />
          <UButton
            icon="i-lucide-trash-2"
            aria-label="Remove"
            color="error"
            variant="ghost"
            size="xs"
            :disabled="modelValue.length <= field.min"
            @click="remove(index)"
          />
        </div>
      </div>

      <UCollapsible v-else v-model:open="expanded[index]">
        <div class="flex items-center gap-1 p-2">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left">
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 shrink-0 text-muted transition-transform"
              :class="expanded[index] ? 'rotate-90' : ''"
            />
            <span class="truncate text-sm font-medium">{{ title(item, index) }}</span>
          </button>
          <UButton
            icon="i-lucide-arrow-up"
            aria-label="Move up"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="index === 0"
            @click.stop="move(index, -1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            aria-label="Move down"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="index === modelValue.length - 1"
            @click.stop="move(index, 1)"
          />
          <UButton
            icon="i-lucide-trash-2"
            aria-label="Remove"
            color="error"
            variant="ghost"
            size="xs"
            :disabled="modelValue.length <= field.min"
            @click.stop="remove(index)"
          />
        </div>
        <template #content>
          <div class="space-y-3 border-t border-default p-3">
            <component
              :is="fieldComponent"
              v-for="key in keys"
              :key="key"
              :field="field.item[key]"
              :model-value="item[key]"
              :errors="itemErrors(index, key)"
              @update:model-value="(value: JsonValue) => update(index, key, value)"
            />
          </div>
        </template>
      </UCollapsible>
    </div>

    <UButton
      label="Add item"
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      size="sm"
      block
      :disabled="modelValue.length >= field.max"
      @click="add"
    />
  </div>
</template>
