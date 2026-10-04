import type { Plugin } from 'vite'

/**
 * Add to the app's vite.config.ts plugins. The components import Nuxt UI's
 * .vue files directly, which Vite can only compile as part of the app: this
 * keeps the package out of dependency pre-bundling and bundles it into the
 * SSR build instead of leaving it for Node to import.
 *
 *   import cms from '@martipops/cms-vue/vite'
 *   plugins: [vue(), ui(), cms(), …]
 */
export default function cms(): Plugin {
  return {
    name: '@martipops/cms-vue',
    config() {
      return {
        optimizeDeps: { exclude: ['@martipops/cms-vue'] },
        ssr: { noExternal: ['@martipops/cms-vue'] },
      }
    },
  }
}
