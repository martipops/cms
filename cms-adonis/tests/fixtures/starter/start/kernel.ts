import router from '@adonisjs/core/services/router'

export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
})
