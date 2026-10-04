import app from '@adonisjs/core/services/app'
import type { Cms } from '../src/cms.js'

let cms: Cms

await app.booted(async () => {
  cms = await app.container.make('cms')
})

export { cms as default }
