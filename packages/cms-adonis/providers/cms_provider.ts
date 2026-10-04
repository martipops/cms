import type { ApplicationService } from '@adonisjs/core/types'
import { Cms } from '../src/cms.js'
import type { CmsConfig } from '../src/types.js'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    cms: Cms
  }
}

export default class CmsProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('cms', () => {
      const config = this.app.config.get<CmsConfig>('cms')
      if (!config) throw new Error('Missing config/cms.ts')
      return new Cms(config)
    })
  }
}
