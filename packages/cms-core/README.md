# @martipops/cms-core

The schema DSL shared by the server and the browser. It has no dependencies.

- **Field builders:** `f.text`, `f.textarea`, `f.number`, `f.boolean`, `f.select`, `f.icon`, `f.image`, `f.file`, `f.link`, `f.url`, `f.group`, `f.list`, `f.custom`
- **Content units:** `section`, `definePage`, `defineCollection`
- **Types:** `SectionValues<typeof section>`, `ItemValues<typeof collection>`, `Document`, `PageProps`, `CollectionProps`
- **Values:** `normalize`, `resolveSection`, `defaultsOf`, `mediaKeysIn`, `slugify`
- **Wire protocol:** `CommitOp`, `CommitError`, `CommitResponse`, `Revision`

Docs: [schema reference](https://github.com/martipops/cms/blob/main/docs/schema.md) · [protocol](https://github.com/martipops/cms/blob/main/docs/protocol.md) · [library overview](https://github.com/martipops/cms#readme)
