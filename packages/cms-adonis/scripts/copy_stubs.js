import { cpSync } from 'node:fs'

// The .stub templates sit next to the compiled stubs/main.js
cpSync('stubs', 'build/stubs', { recursive: true, filter: (path) => !path.endsWith('.ts') })
