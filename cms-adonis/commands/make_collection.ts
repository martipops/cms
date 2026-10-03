import string from '@adonisjs/core/helpers/string'
import { BaseCommand } from '@adonisjs/core/ace'
import { stubsRoot } from '../stubs/main.js'
import { quote, registerInConfig } from '../src/install.js'

export default class MakeCollection extends BaseCommand {
  static commandName = 'cms:make:collection'
  static description = 'Make an editable collection schema and register it in config/cms.ts'

  declare name: string

  static {
    this.defineArgument('name', {
      type: 'string',
      description: 'Collection name, e.g. team_members',
    })
  }

  async run() {
    const entity = this.app.generators.createEntity(this.name)
    const plural = string.pluralize(entity.name)
    const singular = string.singular(entity.name)
    const collectionName = string.camelCase(plural)

    const codemods = await this.createCodemods()
    const output = await codemods.makeUsingStub(stubsRoot, 'make/collection.stub', {
      entity,
      fileName: `${string.snakeCase(plural)}.ts`,
      collectionName,
      label: quote(string.sentenceCase(singular)),
      labelPlural: quote(string.sentenceCase(plural)),
    })
    if (output.status === 'skipped') return

    await registerInConfig(this, 'collections', {
      identifier: collectionName,
      file: output.destination,
    })
  }
}
