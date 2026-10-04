<script lang="ts">
import { defineComponent } from 'vue'
import type { Revision } from '@martipops/cms-core'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { ApiError } from '../http.js'
import {
  editor,
  loadHistory,
  restoreItem,
  restoreSection,
  sectionSchema,
  type HistoryTarget,
} from '../store.js'

/**
 * Past saves of a section or collection item. Restoring stages that version
 * as drafts, so it's previewed first and stored with the toolbar's Save.
 */
export default defineComponent({
  components: { UAlert, UButton, UModal },
  data() {
    return {
      revisions: [] as Revision[],
      loading: false,
      error: '',
    }
  },
  computed: {
    target(): HistoryTarget | null {
      return editor.history
    },
    open: {
      get(): boolean {
        return editor.history !== null
      },
      set(open: boolean) {
        if (!open) editor.history = null
      },
    },
    title(): string {
      const target = this.target
      if (!target) return 'History'
      if (target.kind === 'section') {
        return `History: ${sectionSchema(target.page, target.section)?.label ?? target.section}`
      }
      return `History: ${editor.collections[target.collection]?.schema?.label ?? 'item'}`
    },
  },
  watch: {
    target: {
      immediate: true,
      handler(target: HistoryTarget | null) {
        if (target) this.load(target)
      },
    },
  },
  methods: {
    async load(target: HistoryTarget) {
      this.loading = true
      this.error = ''
      this.revisions = []
      try {
        this.revisions = await loadHistory(target)
      } catch (error) {
        this.error = error instanceof ApiError ? error.message : 'Could not load history'
      } finally {
        this.loading = false
      }
    },
    summary(revision: Revision): string {
      if (revision.action === 'delete') return 'Deleted'
      if (revision.action === 'create') return 'Created'
      const target = this.target
      if (target?.kind === 'section') {
        const keys = Object.keys(revision.data ?? {})
        if (!keys.length) return 'Everything reset to the original'
        const schema = sectionSchema(target.page, target.section)
        const labels = keys.map((key) => schema?.fields[key]?.label ?? key)
        return `Edited: ${labels.join(', ')}`
      }
      return revision.hidden ? 'Saved (hidden)' : 'Saved'
    },
    restore(revision: Revision) {
      const target = this.target
      if (!target) return
      if (target.kind === 'section')
        restoreSection(target.page, target.section, revision.data ?? {})
      else restoreItem(target.collection, target.id, revision)
      this.open = false
    },
    when(iso: string) {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    },
  },
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    description="Restore a previous version. It's applied as unsaved changes you can review first."
  >
    <template #body>
      <UAlert v-if="error" color="error" variant="subtle" :title="error" />
      <p v-else-if="!loading && !revisions.length" class="text-sm text-muted">
        This hasn't been changed yet.
      </p>
      <ul v-else class="divide-y divide-default">
        <li v-for="revision in revisions" :key="revision.id" class="flex items-center gap-3 py-3">
          <div class="min-w-0 flex-1">
            <p class="line-clamp-2 text-sm text-highlighted">{{ summary(revision) }}</p>
            <p class="text-xs text-muted">
              {{ revision.user ?? 'Unknown' }} · {{ when(revision.createdAt) }}
            </p>
          </div>
          <UButton
            v-if="revision.data"
            label="Restore"
            color="neutral"
            variant="subtle"
            size="sm"
            @click="restore(revision)"
          />
        </li>
      </ul>
    </template>
  </UModal>
</template>
