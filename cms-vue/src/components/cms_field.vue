<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { CustomField, Field, JsonValue, LinkValue } from '@martipops/cms-core'
import UButton from '@nuxt/ui/components/Button.vue'
import UFieldGroup from '@nuxt/ui/components/FieldGroup.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UInputNumber from '@nuxt/ui/components/InputNumber.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'
import { mediaUrl, options } from '../options.js'
import CmsFieldGroup from './cms_field_group.vue'
import CmsFieldList from './cms_field_list.vue'

/**
 * Form control for one field, chosen by its type. Groups and lists render
 * their child fields with this same component.
 *
 * `errors` holds server errors keyed by path relative to this field ("" for
 * the field itself, "0.name" for a list item's field).
 */
export default defineComponent({
  components: {
    CmsFieldGroup,
    CmsFieldList,
    UButton,
    UFieldGroup,
    UFormField,
    UIcon,
    UInput,
    UInputNumber,
    USelectMenu,
    USwitch,
    UTextarea,
  },
  props: {
    field: {
      type: Object as PropType<Field>,
      required: true,
    },
    modelValue: {
      type: [String, Number, Boolean, Object, Array] as PropType<JsonValue>,
      default: null,
    },
    errors: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
    hideLabel: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    'update:modelValue': (_value: JsonValue) => true,
  },
  data() {
    return {
      picking: null as string | null,
      options,
    }
  },
  computed: {
    error(): string | undefined {
      return this.errors['']
    },
    text(): string {
      return typeof this.modelValue === 'string' ? this.modelValue : ''
    },
    link(): LinkValue {
      const value = this.modelValue as LinkValue | null
      return value && typeof value === 'object' ? value : { label: '', url: '' }
    },
    object(): Record<string, JsonValue> {
      const value = this.modelValue
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    },
    mediaSrc(): string | null {
      return typeof this.modelValue === 'string' ? mediaUrl(this.modelValue) : null
    },
    selectItems() {
      if (this.field.type !== 'select' && this.field.type !== 'icon') return []
      const withIcons = this.field.type === 'icon'
      return this.field.options.map((o) => ({
        ...o,
        icon: o.icon ?? (withIcons ? o.value : undefined),
      }))
    },
    customComponent() {
      return this.field.type === 'custom' ? options.fields[this.field.component] : undefined
    },
    pickerOpen: {
      get(): boolean {
        return this.picking !== null
      },
      set(open: boolean) {
        if (!open) this.picking = null
      },
    },
    linkFolder(): string | null {
      if (this.field.type !== 'link' || !options.mediaPicker) return null
      return this.field.folder ?? (options.linkFolder || null)
    },
    pickerFolder(): string | null {
      if (this.picking === 'link') return this.linkFolder
      return this.field.type === 'image' || this.field.type === 'file' ? this.field.folder : null
    },
    pickerTitle(): string {
      return this.field.type === 'image' ? 'Choose an image' : 'Choose a file'
    },
  },
  methods: {
    emit(value: JsonValue) {
      this.$emit('update:modelValue', value)
    },
    updateLink(part: keyof LinkValue, value: unknown) {
      this.emit({ ...this.link, [part]: String(value ?? '') })
    },
    picked(media: { key: string; url: string }) {
      if (this.picking === 'link') this.updateLink('url', media.url)
      else this.emit(media.key)
    },
  },
})
</script>

<template>
  <UFormField
    :label="hideLabel || field.type === 'boolean' ? undefined : field.label"
    :help="field.help"
    :error="error"
  >
    <template v-if="field.type === 'text'">
      <UTextarea
        v-if="field.multiline"
        :model-value="text"
        :maxlength="field.max"
        :placeholder="field.placeholder"
        :rows="3"
        autoresize
        class="w-full"
        @update:model-value="emit"
      />
      <UInput
        v-else
        :model-value="text"
        :maxlength="field.max"
        :placeholder="field.placeholder"
        class="w-full"
        @update:model-value="emit"
      />
    </template>

    <UInput
      v-else-if="field.type === 'url'"
      :model-value="text"
      type="url"
      :placeholder="field.placeholder ?? 'https://…'"
      class="w-full"
      @update:model-value="emit"
    />

    <UInputNumber
      v-else-if="field.type === 'number'"
      :model-value="typeof modelValue === 'number' ? modelValue : undefined"
      :min="field.min"
      :max="field.max"
      :step="field.step ?? 1"
      class="w-full"
      @update:model-value="(value) => emit(value ?? null)"
    />

    <USwitch
      v-else-if="field.type === 'boolean'"
      :model-value="modelValue === true"
      :label="field.label"
      @update:model-value="emit"
    />

    <USelectMenu
      v-else-if="field.type === 'select' || field.type === 'icon'"
      :model-value="text"
      :items="selectItems"
      value-key="value"
      :icon="field.type === 'icon' ? text : undefined"
      :search-input="{ placeholder: 'Search…' }"
      class="w-full"
      @update:model-value="emit"
    />

    <div
      v-else-if="field.type === 'image' || field.type === 'file'"
      class="flex items-center gap-3"
    >
      <img
        v-if="field.type === 'image' && mediaSrc"
        :src="mediaSrc"
        alt=""
        class="size-16 rounded-md object-cover"
      />
      <div v-else class="flex size-16 shrink-0 items-center justify-center rounded-md bg-elevated">
        <UIcon
          :name="field.type === 'image' ? 'i-lucide-image-off' : 'i-lucide-file'"
          class="size-6 text-muted"
        />
      </div>
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span v-if="field.type === 'file' && text" class="w-full truncate text-sm">
          {{ text }}
        </span>
        <UButton
          :label="text ? 'Change' : `Choose ${field.type}`"
          :icon="field.type === 'image' ? 'i-lucide-image' : 'i-lucide-file-text'"
          color="neutral"
          variant="subtle"
          size="sm"
          :disabled="!options.mediaPicker"
          @click="picking = 'media'"
        />
        <UButton
          v-if="text && !field.required"
          label="Remove"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="emit(null)"
        />
      </div>
    </div>

    <div v-else-if="field.type === 'link'" class="space-y-2">
      <UInput
        :model-value="link.label"
        placeholder="Label"
        class="w-full"
        @update:model-value="(value) => updateLink('label', value)"
      />
      <UFieldGroup class="w-full">
        <UInput
          :model-value="link.url"
          placeholder="/page or https://…"
          class="w-full"
          @update:model-value="(value) => updateLink('url', value)"
        />
        <UButton
          v-if="linkFolder"
          label="Choose file"
          icon="i-lucide-file-text"
          color="neutral"
          variant="subtle"
          @click="picking = 'link'"
        />
      </UFieldGroup>
    </div>

    <CmsFieldGroup
      v-else-if="field.type === 'group'"
      :field="field"
      :model-value="object"
      :errors="errors"
      @update:model-value="emit"
    />

    <CmsFieldList
      v-else-if="field.type === 'list'"
      :field="field"
      :model-value="Array.isArray(modelValue) ? (modelValue as Record<string, JsonValue>[]) : []"
      :errors="errors"
      @update:model-value="emit"
    />

    <component
      :is="customComponent"
      v-else-if="customComponent"
      :field="field"
      :model-value="modelValue"
      :errors="errors"
      @update:model-value="emit"
    />
    <p v-else class="text-sm text-error">
      No editor registered for "{{ (field as CustomField).component }}"
    </p>

    <component
      :is="options.mediaPicker"
      v-if="options.mediaPicker && picking && pickerFolder"
      v-model:open="pickerOpen"
      :folder="pickerFolder"
      :title="pickerTitle"
      @select="picked"
    />
  </UFormField>
</template>
