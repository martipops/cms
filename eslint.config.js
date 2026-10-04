import { configApp } from '@adonisjs/eslint-config'
import { vue } from '@adonisjs/eslint-config/vue'

const frontend = ['packages/cms-vue/**/*.{ts,vue}']

export default configApp(
  {
    ignores: [
      'packages/*/build/**',
      'packages/*/dist/**',
      'packages/*/tmp/**',
      'packages/*/tests/fixtures/**',
      'docs/.vitepress/dist/**',
      'docs/.vitepress/cache/**',
    ],
  },
  // The Vue preset targets inertia/; apply it to the Vue package instead
  ...vue.map((config) => (config.files ? { ...config, files: frontend } : config)),
  {
    name: 'cms-vue overrides',
    files: frontend,
    rules: {
      'vue/component-api-style': ['error', ['options']],
      'vue/no-reserved-component-names': 'off',
    },
  }
)
