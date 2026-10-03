import 'reflect-metadata'
import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'
import { createTestApp } from '../tests/app.js'

processCLIArgs(process.argv.splice(2))
configure({
  files: ['tests/**/*.spec.ts'],
  plugins: [assert()],
  setup: [
    async () => {
      const app = await createTestApp()
      return () => app.terminate()
    },
  ],
})

run()
