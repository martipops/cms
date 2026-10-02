<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { GroupField, JsonValue } from '@martipops/cms-core'
import { registry } from '../options.js'

/** Editor for a group field: its child fields in a bordered box */
export default defineComponent({
  props: {
    field: {
      type: Object as PropType<GroupField>,
      required: true,
    },
    modelValue: {
      type: Object as PropType<Record<string, JsonValue>>,
      required: true,
    },
    errors: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
  },
  emits: {
    'update:modelValue': (_value: Record<string, JsonValue>) => true,
  },
  computed: {
    fieldComponent() {
      return registry.field
    },
  },
  methods: {
    errorsFor(prefix: string) {
      return Object.fromEntries(
        Object.entries(this.errors)
          .filter(([path]) => path === prefix || path.startsWith(`${prefix}.`))
          .map(([path, message]) => [path.slice(prefix.length + 1), message])
      )
    },
    update(key: string, value: JsonValue) {
      this.$emit('update:modelValue', { ...this.modelValue, [key]: value })
    },
  },
})
</script>

<template>
  <div class="space-y-3 rounded-lg border border-default p-3">
    <component
      :is="fieldComponent"
      v-for="(child, key) in field.fields"
      :key="key"
      :field="child"
      :model-value="modelValue[key]"
      :errors="errorsFor(String(key))"
      @update:model-value="(value: JsonValue) => update(String(key), value)"
    />
  </div>
</template>
