<script lang="ts">
import { defineComponent, markRaw, type PropType } from 'vue'
import { router } from '@inertiajs/vue3'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USeparator from '@nuxt/ui/components/Separator.vue'
import { useToast } from '@nuxt/ui/composables'
import { ApiError } from '../http.js'
import {
  discard,
  draftCount,
  editor,
  openPanel,
  restoreEnabled,
  save,
  setEnabled,
} from '../store.js'
import CmsPanel from './cms_panel.vue'
import CmsHistoryModal from './cms_history_modal.vue'

type Shortcut = { label: string; icon?: string; page: string; section: string }

/**
 * Floating toolbar for editors: turns edit mode on and off, shows unsaved
 * changes, saves or discards them. Also hosts the side panel and history.
 * Render it once, in the layout, for signed-in users.
 */
export default defineComponent({
  components: { CmsHistoryModal, CmsPanel, UBadge, UButton, UIcon, UModal, USeparator },
  props: {
    /**
     * Toolbar buttons for sections that aren't visible on the page as a
     * block, e.g. site-wide header/footer content
     */
    shortcuts: {
      type: Array as PropType<Shortcut[]>,
      default: () => [],
    },
  },
  data() {
    return {
      editor,
      toast: markRaw(useToast()),
      confirmExitOpen: false,
      removeNavigationGuard: null as null | (() => void),
    }
  },
  computed: {
    count(): number {
      return draftCount()
    },
    availableShortcuts(): Shortcut[] {
      return this.shortcuts.filter((s) => editor.pages[s.page]?.schema?.[s.section])
    },
  },
  mounted() {
    restoreEnabled()
    window.addEventListener('beforeunload', this.onBeforeUnload)
    this.removeNavigationGuard = router.on('before', (event) => {
      const visit = event.detail.visit
      if (editor.saving || !draftCount() || visit.method !== 'get' || visit.only.length) return
      if (window.confirm('You have unsaved changes. Leave and discard them?')) discard()
      else event.preventDefault()
    })
  },
  beforeUnmount() {
    window.removeEventListener('beforeunload', this.onBeforeUnload)
    this.removeNavigationGuard?.()
  },
  methods: {
    onBeforeUnload(event: BeforeUnloadEvent) {
      if (draftCount()) event.preventDefault()
    },
    toggle(enabled: boolean) {
      if (!enabled && draftCount()) {
        this.confirmExitOpen = true
        return
      }
      setEnabled(enabled)
    },
    async saveAll() {
      try {
        await save()
        this.toast.add({ title: 'Changes saved', color: 'success', icon: 'i-lucide-check-circle' })
      } catch (error) {
        this.toast.add({
          title: 'Nothing was saved',
          description:
            error instanceof ApiError
              ? `${error.message}. Fix the highlighted fields and save again.`
              : 'Something went wrong',
          color: 'error',
          icon: 'i-lucide-circle-alert',
        })
      }
    },
    discard,
    discardAndExit() {
      discard()
      this.confirmExitOpen = false
      setEnabled(false)
    },
    openShortcut(shortcut: Shortcut) {
      openPanel({ kind: 'section', page: shortcut.page, section: shortcut.section })
    },
  },
})
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
    <UButton
      v-if="!editor.enabled"
      label="Edit page"
      icon="i-lucide-pencil"
      color="neutral"
      variant="solid"
      size="lg"
      class="pointer-events-auto rounded-full shadow-xl"
      @click="toggle(true)"
    />

    <div
      v-else
      class="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-default bg-default/95 p-2 shadow-2xl backdrop-blur"
    >
      <div class="flex items-center gap-1 pr-1 pl-2">
        <UIcon name="i-lucide-pencil" class="size-4 text-primary" />
        <span class="text-sm font-medium">Editing</span>
      </div>

      <template v-if="availableShortcuts.length">
        <USeparator orientation="vertical" class="h-6" />
        <UButton
          v-for="shortcut in availableShortcuts"
          :key="`${shortcut.page}.${shortcut.section}`"
          :label="shortcut.label"
          :icon="shortcut.icon ?? 'i-lucide-panel-bottom'"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="openShortcut(shortcut)"
        />
      </template>

      <USeparator orientation="vertical" class="h-6" />
      <UBadge
        :label="count ? `${count} unsaved` : 'No changes'"
        :color="count ? 'warning' : 'neutral'"
        variant="subtle"
      />
      <UButton
        label="Discard"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="!count || editor.saving"
        @click="discard"
      />
      <UButton
        label="Save"
        icon="i-lucide-check"
        size="sm"
        :disabled="!count"
        :loading="editor.saving"
        @click="saveAll"
      />
      <UButton
        icon="i-lucide-x"
        aria-label="Exit edit mode"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="toggle(false)"
      />
    </div>

    <CmsPanel />
    <CmsHistoryModal />

    <UModal
      v-model:open="confirmExitOpen"
      title="Discard unsaved changes?"
      :description="`You have ${count} unsaved change${count === 1 ? '' : 's'}. Save them first, or discard and exit edit mode.`"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Keep editing"
            color="neutral"
            variant="ghost"
            @click="confirmExitOpen = false"
          />
          <UButton label="Discard & exit" color="error" @click="discardAndExit" />
        </div>
      </template>
    </UModal>
  </div>
</template>
