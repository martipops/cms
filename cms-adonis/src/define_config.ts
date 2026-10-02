import type { CmsConfig, CmsConfigInput, FieldTypeDefinition } from './types.js'

/**
 * Defines the CMS config (config/cms.ts): which pages and collections are
 * editable, custom field types, and how to authorize editors.
 */
export function defineConfig(config: CmsConfigInput): CmsConfig {
  return {
    pages: [],
    collections: [],
    fieldTypes: [],
    user: () => null,
    ...config,
  }
}

/** Defines a site-specific field type (see `f.custom` in schemas) */
export function defineFieldType(definition: FieldTypeDefinition): FieldTypeDefinition {
  return definition
}
