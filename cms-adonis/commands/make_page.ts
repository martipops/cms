import string from '@adonisjs/core/helpers/string'
import { BaseCommand } from '@adonisjs/core/ace'
import { stubsRoot } from '../stubs/main.js'
import { quote, registerInConfig } from '../src/install.js'

export default class MakePage extends BaseCommand {
  static commandName = 'cms:make:page'
  static description = 'Make an editable page schema and register it in config/cms.ts'

  declare name: string

  static {
    this.defineArgument('name', { type: 'string', description: 'Page name, e.g. home or about' })
  }

  async run() {
    const entity = this.app.generators.createEntity(this.name)
    const codemods = await this.createCodemods()
    const output = await codemods.makeUsingStub(stubsRoot, 'make/page.stub', {
      entity,
      fileName: `${string.snakeCase(entity.name)}.ts`,
      pageName: string.camelCase(entity.name),
      componentName: string.snakeCase(entity.name),
      title: quote(string.sentenceCase(entity.name)),
      titleBinding: '{{ data.title }}',
    })
    if (output.status === 'skipped') return

    await registerInConfig(this, 'pages', {
      identifier: `${string.camelCase(entity.name)}Page`,
      file: output.destination,
    })
  }
}
