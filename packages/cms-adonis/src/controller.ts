import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import type { CommitOp } from '@martipops/cms-core'
import { CommitValidationError } from './cms.js'

const commitValidator = vine.create({
  ops: vine
    .array(
      vine
        .object({
          type: vine.enum([
            'section.save',
            'doc.create',
            'doc.update',
            'doc.delete',
            'doc.reorder',
          ]),
        })
        .allowUnknownProperties()
    )
    .minLength(1)
    .maxLength(200),
})

const historyValidator = vine.create({
  page: vine.string().maxLength(60).optional().requiredIfMissing('collection'),
  section: vine.string().maxLength(60).optional().requiredIfExists('page'),
  collection: vine.string().maxLength(60).optional(),
  id: vine.number().withoutDecimals().optional().requiredIfExists('collection'),
})

/**
 * JSON endpoints used by edit mode. Registered with `registerRoutes()`;
 * every action checks the config's `authorize` hook.
 */
export default class CmsController {
  async commit(ctx: HttpContext) {
    const cms = await ctx.containerResolver.make('cms')
    if (!(await cms.canEdit(ctx))) return ctx.response.forbidden({ message: 'Not allowed' })

    // The raw body, since the app's bodyparser may turn "" into null and
    // clearing a text field is a legitimate edit
    const raw = ctx.request.raw()
    const { ops } = await commitValidator.validate(raw ? JSON.parse(raw) : ctx.request.body())
    try {
      return await cms.commit(ops as unknown as CommitOp[], cms.config.user(ctx))
    } catch (error) {
      if (error instanceof CommitValidationError) {
        return ctx.response.unprocessableEntity({ message: error.message, errors: error.errors })
      }
      throw error
    }
  }

  async history(ctx: HttpContext) {
    const cms = await ctx.containerResolver.make('cms')
    if (!(await cms.canEdit(ctx))) return ctx.response.forbidden({ message: 'Not allowed' })

    const query = await historyValidator.validate(ctx.request.qs())
    const target = query.collection
      ? { collection: query.collection, id: query.id! }
      : { page: query.page!, section: query.section! }
    return { data: await cms.history(target) }
  }
}
