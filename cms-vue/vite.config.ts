import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** Peer dependencies stay imports; the app provides them */
const external = /^(vue|@inertiajs\/vue3|@nuxt\/ui|@martipops\/cms-core|vite)(\/|$)/

/**
 * Builds the package to dist/: the components and store (index), and the
 * Vite plugin apps add to their config (vite)
 */
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: { index: 'src/index.ts', vite: 'src/vite.ts' },
      formats: ['es'],
    },
    rollupOptions: { external: (id) => external.test(id) },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
  },
})
