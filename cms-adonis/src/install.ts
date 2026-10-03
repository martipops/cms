import { readFile, writeFile } from 'node:fs/promises'
import { relative } from 'node:path'
import type { BaseCommand } from '@adonisjs/core/ace'
import type {
  ArrayLiteralExpression,
  CallExpression,
  ObjectLiteralExpression,
  PropertyAssignment,
} from 'ts-morph'

/**
 * Source edits made by `configure` and the make commands. Each one checks
 * whether it already ran and, when a file doesn't look the way it expects,
 * prints the manual step instead of guessing.
 */

type Command = Pick<BaseCommand, 'app' | 'logger' | 'createCodemods'>
type Project = NonNullable<
  Awaited<ReturnType<Awaited<ReturnType<Command['createCodemods']>>['getTsMorphProject']>>
>

async function project(command: Command): Promise<Project | null> {
  const codemods = await command.createCodemods()
  return (await codemods.getTsMorphProject()) ?? null
}

function sourceFile(tsProject: Project, path: string) {
  return tsProject.getSourceFile(path) ?? tsProject.addSourceFileAtPathIfExists(path)
}

async function readText(path: string) {
  return readFile(path, 'utf8').catch(() => null)
}

/** Adds an import the way Adonis apps write them (ts-morph adds a semicolon) */
function addImport(
  file: NonNullable<ReturnType<typeof sourceFile>>,
  structure: Parameters<NonNullable<ReturnType<typeof sourceFile>>['addImportDeclaration']>[0]
) {
  const declaration = file.addImportDeclaration(structure)
  declaration.replaceWithText(declaration.getText().replace(/;$/, ''))
}

function manual(command: Command, file: string, instruction: string) {
  command.logger.warning(`Couldn't update ${file} automatically. ${instruction}`)
}

/** Mounts the edit-mode endpoints under /admin/cms in start/routes.ts */
export async function registerRoutes(command: Command) {
  const path = command.app.startPath('routes.ts')
  const snippet = `router.group(() => registerCmsRoutes(router)).prefix('admin/cms')`
  const tsProject = await project(command)
  const file = tsProject && sourceFile(tsProject, path)
  if (!file) return manual(command, 'start/routes.ts', `Add: ${snippet}`)
  if (file.getFullText().includes('registerCmsRoutes')) return

  // Signed-in users only, when the app has an auth middleware. The
  // endpoints check config/cms.ts `authorize` either way.
  const kernel = (await readText(command.app.startPath('kernel.ts'))) ?? ''
  const auth = /\bauth\s*:/.test(kernel)
  const importsMiddleware = file
    .getImportDeclarations()
    .some((d) => d.getNamedImports().some((n) => n.getName() === 'middleware'))

  addImport(file, { moduleSpecifier: '@sonata/cms-adonis', namedImports: ['registerCmsRoutes'] })
  if (auth && !importsMiddleware) {
    addImport(file, { moduleSpecifier: '#start/kernel', namedImports: ['middleware'] })
  }
  file.addStatements([
    '',
    `// Content editing (every endpoint also checks config/cms.ts \`authorize\`)`,
    `${snippet}${auth ? '.use(middleware.auth())' : ''}`,
  ])
  await file.save()
  command.logger.info('Mounted the CMS endpoints at /admin/cms in start/routes.ts')
}

/** Installs the Vue plugin after Nuxt UI in inertia/app.ts */
export async function registerVuePlugin(command: Command) {
  const path = command.app.makePath('inertia/app.ts')
  const instruction = `Import cms from '@sonata/cms-vue' and add .use(cms, { endpoint: '/admin/cms' }) after .use(ui)`
  const source = await readText(path)
  if (source === null) return manual(command, 'inertia/app.ts', instruction)
  if (source.includes('@sonata/cms-vue')) return

  const use = /^([ \t]*)(.*\.use\(ui\b[^)]*\))/m.exec(source)
  const imports = [...source.matchAll(/^import .*$/gm)].at(-1)
  if (!use || !imports) return manual(command, 'inertia/app.ts', instruction)

  const indent = use[1] + (use[2].trimStart().startsWith('.') ? '' : '  ')
  const afterUse = use.index + use[0].length
  const afterImports = imports.index + imports[0].length
  const updated =
    source.slice(0, afterImports) +
    `\nimport cms from '@sonata/cms-vue'` +
    source.slice(afterImports, afterUse) +
    `\n${indent}.use(cms, { endpoint: '/admin/cms' })` +
    source.slice(afterUse)
  await writeFile(path, updated)
  command.logger.info('Installed the CMS Vue plugin in inertia/app.ts')
}

/** Lets Tailwind see the edit-mode components (inertia/css/app.css) */
export async function registerTailwind(command: Command) {
  const path = command.app.makePath('inertia/css/app.css')
  const line = `@import '@sonata/cms-vue/tailwind.css';`
  const source = await readText(path)
  if (source === null) return manual(command, 'inertia/css/app.css', `Add ${line} after Nuxt UI`)
  if (source.includes('@sonata/cms-vue/tailwind.css')) return

  const nuxtUi = /^@import ['"]@nuxt\/ui['"];?[ \t]*$/m.exec(source)
  if (!nuxtUi) return manual(command, 'inertia/css/app.css', `Add ${line} after Nuxt UI`)

  const at = nuxtUi.index + nuxtUi[0].length
  await writeFile(path, `${source.slice(0, at)}\n${line}${source.slice(at)}`)
  command.logger.info('Added the CMS Tailwind entry to inertia/css/app.css')
}

/**
 * Adds a schema to one of config/cms.ts's lists (`pages`, `collections`,
 * `fieldTypes`) and imports it
 */
export async function registerInConfig(
  command: Command,
  list: 'pages' | 'collections' | 'fieldTypes',
  item: { identifier: string; file: string; named?: boolean }
) {
  const path = command.app.configPath('cms.ts')
  const fromConfig = relative(command.app.configPath(), item.file)
    .replace(/\\/g, '/')
    .replace(/\.ts$/, '.js')
  const moduleSpecifier = fromConfig.startsWith('.') ? fromConfig : `./${fromConfig}`
  const instruction = `Import ${item.identifier} from '${moduleSpecifier}' and add it to \`${list}\``

  const tsProject = await project(command)
  const file = tsProject && sourceFile(tsProject, path)
  const call = file?.getExportAssignment(() => true)?.getExpression()
  if (!file || call?.getKindName() !== 'CallExpression') {
    return manual(command, 'config/cms.ts', instruction)
  }
  const [options] = (call as CallExpression).getArguments()
  if (options?.getKindName() !== 'ObjectLiteralExpression') {
    return manual(command, 'config/cms.ts', instruction)
  }
  const object = options as ObjectLiteralExpression
  const property =
    object.getProperty(list) ??
    object.insertPropertyAssignment(0, { name: list, initializer: '[]' })
  const array = (property as PropertyAssignment).getInitializer?.()
  if (array?.getKindName() !== 'ArrayLiteralExpression') {
    return manual(command, 'config/cms.ts', instruction)
  }
  const elements = (array as ArrayLiteralExpression).getElements()
  if (elements.some((element) => element.getText() === item.identifier)) return

  ;(array as ArrayLiteralExpression).addElement(item.identifier)
  addImport(
    file,
    item.named
      ? { moduleSpecifier, namedImports: [item.identifier] }
      : { moduleSpecifier, defaultImport: item.identifier }
  )
  await file.save()
  command.logger.info(`Registered ${item.identifier} in config/cms.ts (${list})`)
}
/** A string as a single-quoted TypeScript literal, for stubs */
export function quote(value: string) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}
