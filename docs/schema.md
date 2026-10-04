# Schema reference

Schemas come from `@martipops/cms-core`. They're plain, JSON-serializable objects, so the same definition drives the editor in the browser and validation on the server.

```ts
import { f, definePage, section, defineCollection } from '@martipops/cms-core'
```

## Pages and sections

```ts
definePage(name: string, sections: Record<string, Section>)
section(label: string, fields: Record<string, Field>, { description? })
```

- **Section and field keys** must be plain identifiers (`hero`, `orderOnlineUrl`). `definePage` throws otherwise.
- **`label`** is the panel title and the edit button text ("Edit Hero").
- **`description`** shows under the panel title. Use it to point to related editors ("The cards themselves are edited by clicking them").

## Collections

```ts
defineCollection(name, {
  label: 'Location',            // singular
  labelPlural: 'Locations',     // defaults to label + "s"
  titleField: 'shortName',      // each item's title in the editor list
  slugFrom: 'shortName',        // optional; slug generated once, on create
  allow: { create, delete, reorder, hide },   // each defaults to true
  fields: { … },
  initial: [{ slug?: 'downtown', …values }], // inserted once, ever
})
```

## Field types

Every builder takes one options object. Every field accepts **`label`** (defaults to the key, humanised: `orderOnlineUrl` → "Order online url") and **`help`** (text under the input).

| Builder      | Value            | Options (defaults)                                                                              | Server validation                                                                           | Editor                                         |
| ------------ | ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `f.text`     | `string`         | `default ''`, `max 160` (1000 if multiline), `multiline false`, `required false`, `placeholder` | trimmed; ≤ max; ≥1 char if required; no line breaks unless multiline                        | `UInput` / `UTextarea`                         |
| `f.textarea` | `string`         | same as text, `multiline: true`                                                                 | as text                                                                                     | `UTextarea` (autoresize)                       |
| `f.number`   | `number \| null` | `default null`, `min`, `max`, `step`, `integer false`                                           | number in range; no decimals if integer; nullable                                           | `UInputNumber`                                 |
| `f.boolean`  | `boolean`        | `default false`                                                                                 | strict boolean                                                                              | `USwitch`                                      |
| `f.select`   | `string`         | `options` (strings or `{ value, label, icon? }`), default = first option                        | one of the option values                                                                    | `USelectMenu`                                  |
| `f.icon`     | `string`         | `options` (required), default = first option                                                    | one of the option values                                                                    | searchable `USelectMenu` showing icons         |
| `f.image`    | `string \| null` | `default null`, `folder 'images'`, `required false`                                             | key under `folder/` that `media.exists` confirms; nullable unless required                  | thumbnail + media picker + Remove              |
| `f.file`     | `string \| null` | `default null`, `folder 'files'`, `required false`                                              | key under `folder/` that `media.exists` confirms                                            | file name + media picker                       |
| `f.link`     | `{ label, url }` | `default { label: '', url: '' }`, `folder` (picker folder; defaults to the `linkFolder` option) | label 1–80 chars; url ≤500, internal (`/…`), `http(s)://`, `mailto:` or `tel:`              | label + URL + **Choose file**                  |
| `f.url`      | `string`         | `default ''`, `required false`, `prefixes`, `placeholder`                                       | ≤2000; must start with one of `prefixes` (or the link rules); empty allowed unless required | `UInput type=url`                              |
| `f.group`    | object           | `f.group({ …fields }, { label? })`                                                              | each child field                                                                            | bordered box of child fields                   |
| `f.list`     | object[]         | `f.list({ …itemFields }, { min 0, max 50, default [], itemTitle })`                             | array length within min..max; each item's fields                                            | collapsible items (inline if one simple field) |
| `f.custom`   | any JSON         | `f.custom(name, { default, options? })`                                                         | the registered type's validator                                                             | the registered component                       |

### Types come along for free

```ts
const hero = section('Hero', {
  title: f.text(),
  stats: f.list({ value: f.text(), big: f.boolean() }),
  cta: f.group({ label: f.text(), href: f.url() }),
})

type Hero = SectionValues<typeof hero>
// { title: string; stats: { value: string; big: boolean }[]; cta: { label: string; href: string } }

type Location = ItemValues<typeof locations>
```

Use these on the server, and for casting in the browser until [typed slot data](roadmap.md#typed-content) lands.

### List titles

In the editor, a list item's title is `itemTitle`'s value, falling back to the first text field, then "Item N". Pick a field staff will recognise (`itemTitle: 'name'`).

## Custom field types

When none of the built-ins fit, for example an opening-hours grid, a price with sizes or a map pin, define your own type. You need two halves, registered under the same name.

**1. Schema helper** (optional, but it gives a typed default):

```ts
// app/cms/fields.ts
export function weeklyHours(options: { label?: string } = {}) {
  return f.custom('weeklyHours', {
    ...options,
    default: WEEKDAYS.map((day) => ({ day, opens: null, closes: null })),
  })
}
```

**2. Server validator**, registered in `config/cms.ts` → `fieldTypes`:

```ts
export const weeklyHoursType = defineFieldType({
  name: 'weeklyHours',
  validator: (field) =>
    vine
      .array(vine.object({ day: vine.enum(WEEKDAYS), opens: time(), closes: time() }))
      .fixedLength(7)
      .use(tidyHours()), // validators may also clean values up (field.mutate)
  mediaKeys: (value) => [], // optional: media this value references
})
```

**3. Editor component**, registered with the Vue plugin (`fields: { weeklyHours: WeeklyHoursField }`). Its contract:

| Prop / event               | Type                    | Notes                                                       |
| -------------------------- | ----------------------- | ----------------------------------------------------------- |
| `modelValue`               | the value               | Treat it as immutable; emit a new value                     |
| `field`                    | the `CustomField`       | Read `field.options` for per-use configuration              |
| `errors`                   | `Record<path, message>` | Paths relative to this field (`"2.opens"`, `""` for itself) |
| `update:modelValue` (emit) | the new value           | Every emit becomes a draft and previews live                |

A custom type that's missing on either side fails loudly. The server throws at boot ("Unknown CMS field type"), and the editor shows "No editor registered for …".

## Schema changes over time

Stored data is reconciled with the current schema on every read (see `normalize`), so most changes are free:

| Change                       | What happens to existing data                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Add a field                  | Shows its default until edited                                                                              |
| Remove a field               | Its stored value is ignored (and dropped on the next save)                                                  |
| Change a default             | Shows everywhere it hasn't been edited                                                                      |
| Tighten a rule (lower `max`) | Existing values still render; the next save must satisfy the rule                                           |
| Remove a select option       | Items using it fall back to the default                                                                     |
| Add a key to list items      | Existing items get that key's default                                                                       |
| **Rename** a field           | ⚠️ Looks like remove + add: the edited value is lost. See [schema migrations](roadmap.md#schema-migrations) |
| **Change a field's type**    | ⚠️ Stored values of the old shape fall back to the default                                                  |
