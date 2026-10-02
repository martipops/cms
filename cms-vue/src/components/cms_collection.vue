<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { CollectionProps } from '@martipops/cms-core'
import UButton from '@nuxt/ui/components/Button.vue'
import {
  canEditCollection,
  collectionDirty,
  collectionItems,
  openPanel,
  registerCollection,
  type Item,
} from '../store.js'

/**
 * A collection rendered on a page. The slot gets the visible `items` (with
 * edit-mode drafts applied) and `edit(item)`, which opens that item in the
 * side panel. In edit mode a button opens the whole list.
 *
 *   <CmsCollection v-slot="{ items, edit }" :collection="locations">
 *     <LocationCard v-for="item in items" :key="item.key" :location="item.data" @click="edit(item)" />
 *   </CmsCollection>
 */
export default defineComponent({
  components: { UButton },
  inheritAttrs: false,
  props: {
    collection: {
      type: Object as PropType<CollectionProps<any>>,
      required: true,
    },
    tag: {
      type: String,
      default: 'div',
    },
    buttonClass: {
      type: String,
      default: 'top-2 right-2',
    },
    /** Hide the "Edit …" button (e.g. when items open themselves via `edit`) */
    noButton: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    name(): string {
      return this.collection.name
    },
    editable(): boolean {
      return canEditCollection(this.name)
    },
    all(): Item[] {
      return this.editable
        ? collectionItems(this.name)
        : this.collection.items.map((doc) => ({
            key: doc.id,
            id: doc.id,
            slug: doc.slug,
            hidden: doc.hidden,
            data: doc.data,
            isNew: false,
            dirty: false,
          }))
    },
    items(): Item[] {
      return this.all.filter((item) => !item.hidden)
    },
    dirty(): boolean {
      return collectionDirty(this.name)
    },
  },
  watch: {
    collection: {
      immediate: true,
      handler(collection: CollectionProps) {
        registerCollection(collection)
      },
    },
  },
  methods: {
    edit(item?: Item) {
      if (!this.editable) return
      openPanel({ kind: 'collection', collection: this.name, focus: item?.key })
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
            dirty ? 'outline-dashed outline-warning' : 'outline-dashed outline-primary/40',
          ]
        : undefined
    "
  >
    <slot :items="items" :all="all" :edit="edit" :editable="editable" />

    <UButton
      v-if="editable && !noButton"
      :label="`Edit ${collection.schema!.labelPlural.toLowerCase()}`"
      icon="i-lucide-list"
      color="neutral"
      variant="solid"
      size="sm"
      class="absolute z-30 shadow-lg"
      :class="buttonClass"
      @click.prevent.stop="edit()"
    />
  </component>
</template>
