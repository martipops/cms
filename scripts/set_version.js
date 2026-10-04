import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Sets one version on all three packages, and the range they use for each
 * other (under 0.x, ^0.1.0 doesn't accept 0.2.0):
 *
 *   npm run set-version -- 0.2.0
 */
const version = process.argv[2]
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) {
  console.error('Usage: npm run set-version -- <version>, e.g. 0.2.0')
  process.exit(1)
}

for (const name of ['cms-core', 'cms-adonis', 'cms-vue']) {
  const path = `packages/${name}/package.json`
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.version = version
  for (const dependency of Object.keys(pkg.dependencies ?? {})) {
    if (dependency.startsWith('@martipops/cms-')) pkg.dependencies[dependency] = `^${version}`
  }
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`${pkg.name} → ${version}`)
}
