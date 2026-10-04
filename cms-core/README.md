# @martipops/cms-core

The schema DSL shared by the server and the browser. It has no dependencies.

- **Field builders:** `f.text`, `f.textarea`, `f.number`, `f.boolean`, `f.select`, `f.icon`, `f.image`, `f.file`, `f.link`, `f.url`, `f.group`, `f.list`, `f.custom`
- **Content units:** `section`, `definePage`, `defineCollection`
- **Types:** `SectionValues<typeof section>`, `ItemValues<typeof collection>`, `Document`, `PageProps`, `CollectionProps`
- **Values:** `normalize`, `resolveSection`, `defaultsOf`, `mediaKeysIn`, `slugify`
- **Wire protocol:** `CommitOp`, `CommitError`, `CommitResponse`, `Revision`

Docs: [schema reference](../docs/schema.md) · [protocol](../docs/protocol.md) · [library overview](../README.md)
