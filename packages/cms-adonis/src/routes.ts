import type { Router } from '@adonisjs/core/http'

const controller = () => import('../src/controller.js')

/**
 * Registers the edit-mode endpoints. Call it inside a route group that
 * applies your auth middleware and prefix:
 *
 *   router.group(() => registerCmsRoutes(router)).prefix('admin/cms').use(middleware.auth())
 */
export function registerCmsRoutes(router: Router) {
  router.post('commit', [controller, 'commit']).as('cms.commit')
  router.get('history', [controller, 'history']).as('cms.history')
}
