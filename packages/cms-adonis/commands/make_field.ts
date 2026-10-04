import string from '@adonisjs/core/helpers/string'
import { BaseCommand } from '@adonisjs/core/ace'
import { stubsRoot } from '../stubs/main.js'
import { registerInConfig } from '../src/install.js'

export default class MakeField extends BaseCommand {
  static commandName = 'cms:make:field'
  static description = 'Make a custom field type: a server validator and a Vue editor'

  declare name: string

  static {
    this.defineArgument('name', { type: 'string', description: 'Field type, e.g. opening_hours' })
  }

  async run() {
    const entity = this.app.generators.createEntity(this.name)
    const typeName = string.camelCase(entity.name)
    const editorName = `${string.pascalCase(entity.name)}Field`
    const editorPath = `inertia/components/cms/${string.snakeCase(entity.name)}_field.vue`

    const codemods = await this.createCodemods()
    const output = await codemods.makeUsingStub(stubsRoot, 'make/field/type.stub', {
      entity,
      fileName: `${string.snakeCase(entity.name)}.ts`,
      typeName,
      editorName,
      editorPath,
    })
    await codemods.makeUsingStub(stubsRoot, 'make/field/editor.stub', { typeName, editorPath })
    if (output.status === 'skipped') return

    await registerInConfig(this, 'fieldTypes', {
      identifier: `${typeName}Type`,
      file: output.destination,
      named: true,
    })
    this.logger.info(
      `Register the editor: .use(cms, { fields: { ${typeName}: ${editorName} } }) in inertia/app.ts`
    )
  }
}
