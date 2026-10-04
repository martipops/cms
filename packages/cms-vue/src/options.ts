import type { Component } from 'vue'

export type CmsVueOptions = {
  /** Where the server's CMS routes are mounted (see `registerCmsRoutes`) */
  endpoint: string
  /**
   * Dialog for choosing media. Props: `open`, `folder`, `title`. Emits
   * `update:open` and `select` with `{ key, url }`.
   */
  mediaPicker?: Component
  /** Editor components for custom field types, by name */
  fields?: Record<string, Component>
  /** Public URL of a media key. Default `/media/<key>` */
  mediaUrl?: (key: string) => string
  /**
   * Media folder link fields offer files from (fields can override it with
   * `folder`). `false` hides the picker on links. Default "files"
   */
  linkFolder?: string | false
}

export const options: Required<Omit<CmsVueOptions, 'mediaPicker'>> &
  Pick<CmsVueOptions, 'mediaPicker'> = {
  endpoint: '/admin/cms',
  fields: {},
  mediaUrl: (key) => `/media/${key}`,
  linkFolder: 'files',
}

export function configure(input: CmsVueOptions) {
  Object.assign(options, input)
}

/**
 * Components that render each other recursively (a list item's fields are
 * CmsFields). Linked at install time to keep their types non-circular.
 */
export const registry: { field: Component | null } = { field: null }

/** Public URL of a media key (null for none) */
export function mediaUrl(key: string | null | undefined) {
  return key ? options.mediaUrl(key) : null
}
