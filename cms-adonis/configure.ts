import type Configure from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/main.js'
import { registerRoutes, registerTailwind, registerVuePlugin } from './src/install.js'

/**
 * `node ace configure @martipops/cms-adonis`: registers the provider and
 * commands, creates config/cms.ts and the migration, mounts the routes, and
 * installs the Vue plugin and Tailwind entry
 */
export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@martipops/cms-adonis/cms_provider')
    rcFile.addCommand('@martipops/cms-adonis/commands')
  })
  await codemods.makeUsingStub(stubsRoot, 'config/cms.stub', {})
  await codemods.makeUsingStub(stubsRoot, 'migration/create_cms_tables.stub', {
    fileName: `${Date.now()}_create_cms_tables.ts`,
  })

  await registerRoutes(command)
  await registerVuePlugin(command)
  await registerTailwind(command)

  command.logger.log('')
  command.logger.info('Next:')
  command.logger.log('  1. Set `authorize` in config/cms.ts (nobody can edit until you do)')
  command.logger.log('  2. node ace migration:run')
  command.logger.log('  3. Render <CmsToolbar /> in your layout for signed-in users')
  command.logger.log('  4. node ace cms:make:page home')
}
