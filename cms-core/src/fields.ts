/**
 * Field definitions. Every editable value (a section's fields, a collection
 * item's fields) is described by one of these. Definitions are plain,
 * JSON-serializable objects: the server turns them into validators and the
 * editor turns them into form inputs.
 *
 * Build them with the `f.*` helpers below rather than by hand.
 */

/** JSON-serializable value (content is stored as JSON and sent as page props) */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type Option = { value: string; label: string; icon?: string }

type Base = {
  /** Shown above the input. Defaults to the field's key, humanised */
  label: string
  /** Help text shown under the input */
  help?: string
}

export type TextField = Base & {
  type: 'text'
  default: string
  max: number
  /** Allows line breaks (rendered as a textarea) */
  multiline: boolean
  /** Rejects an empty value */
  required: boolean
  placeholder?: string
}

export type NumberField = Base & {
  type: 'number'
  default: number | null
  min?: number
  max?: number
  step?: number
  integer: boolean
}

export type BooleanField = Base & {
  type: 'boolean'
  default: boolean
}

export type SelectField = Base & {
  type: 'select'
  default: string
  options: Option[]
}

/** Media library key (e.g. "images/marquee/1.webp") or null */
export type ImageField = Base & {
  type: 'image'
  default: string | null
  required: boolean
}

/** Media library key of a non-image file (e.g. "pdfs/menu.pdf") or null */
export type FileField = Base & {
  type: 'file'
  default: string | null
  /** Media folder to pick from */
  folder: string
  required: boolean
}

export type LinkValue = { label: string; url: string }

/** A label + URL pair. URLs may point at media files ("/media/pdfs/menu.pdf") */
export type LinkField = Base & {
  type: 'link'
  default: LinkValue
}

export type UrlField = Base & {
  type: 'url'
  default: string
  required: boolean
  /** Only accept URLs starting with one of these */
  prefixes?: string[]
  placeholder?: string
}

export type IconField = Base & {
  type: 'icon'
  default: string
  options: Option[]
}

/** Several fields edited together, stored as one object */
export type GroupField = Base & {
  type: 'group'
  fields: Record<string, Field>
}

/** Repeating items, edited as a list of collapsible forms */
export type ListField = Base & {
  type: 'list'
  item: Record<string, Field>
  default: Record<string, JsonValue>[]
  min: number
  max: number
  /** Item field shown as each item's title in the editor */
  itemTitle?: string
}

/**
 * A field type the site registers itself (a server validator and an editor
 * component with the same name), e.g. an opening-hours grid
 */
export type CustomField = Base & {
  type: 'custom'
  /** Registered field type name */
  component: string
  default: JsonValue
  /** Options passed to the server validator and the editor component */
  options?: Record<string, JsonValue>
}

export type Field =
  | TextField
  | NumberField
  | BooleanField
  | SelectField
  | ImageField
  | FileField
  | LinkField
  | UrlField
  | IconField
  | GroupField
  | ListField
  | CustomField

export type FieldType = Field['type']

/** The value a field holds */
export type ValueOf<F> = F extends GroupField
  ? ValuesOf<F['fields']>
  : F extends ListField
    ? ValuesOf<F['item']>[]
    : F extends { default: infer D }
      ? D
      : never

/** The values of a set of fields, keyed like the fields */
export type ValuesOf<Fields extends Record<string, Field>> = {
  -readonly [K in keyof Fields]: ValueOf<Fields[K]>
}

/*
|--------------------------------------------------------------------------
| Builders
|--------------------------------------------------------------------------
|
| Labels are optional: `define*` fills missing ones in from the field key
| ("orderOnlineUrl" → "Order online url").
|
*/

type Opts<F> = Partial<Omit<F, 'type'>>

function text(options: Opts<TextField> = {}): TextField {
  const multiline = options.multiline ?? false
  return {
    label: '',
    default: '',
    required: false,
    ...options,
    type: 'text',
    multiline,
    max: options.max ?? (multiline ? 1000 : 160),
  }
}

/** Shorthand for a multiline text field */
function textarea(options: Opts<TextField> = {}): TextField {
  return text({ ...options, multiline: true })
}

function number(options: Opts<NumberField> = {}): NumberField {
  return { label: '', default: null, integer: false, ...options, type: 'number' }
}

function boolean(options: Opts<BooleanField> = {}): BooleanField {
  return { label: '', default: false, ...options, type: 'boolean' }
}

function select(
  options: Omit<Opts<SelectField>, 'options'> & { options: (Option | string)[] }
): SelectField {
  const choices = options.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return {
    label: '',
    default: choices[0]?.value ?? '',
    ...options,
    type: 'select',
    options: choices,
  }
}

function image(options: Opts<ImageField> = {}): ImageField {
  return { label: '', default: null, required: false, ...options, type: 'image' }
}

function file(options: Opts<FileField> = {}): FileField {
  return { label: '', default: null, folder: 'pdfs', required: false, ...options, type: 'file' }
}

function link(options: Opts<LinkField> = {}): LinkField {
  return { label: '', default: { label: '', url: '' }, ...options, type: 'link' }
}

function url(options: Opts<UrlField> = {}): UrlField {
  return { label: '', default: '', required: false, ...options, type: 'url' }
}

function icon(options: Opts<IconField> & { options: Option[] }): IconField {
  return {
    label: '',
    default: options.options[0]?.value ?? '',
    ...options,
    type: 'icon',
    options: options.options.map((o) => ({ ...o })),
  }
}

function group<Fields extends Record<string, Field>>(
  fields: Fields,
  options: Opts<Omit<GroupField, 'fields' | 'type'>> = {}
): Omit<GroupField, 'fields'> & { fields: Fields } {
  return { label: '', ...options, type: 'group', fields }
}

function list<Item extends Record<string, Field>>(
  item: Item,
  options: Omit<Opts<ListField>, 'item' | 'default'> & { default?: ValuesOf<Item>[] } = {}
): Omit<ListField, 'item' | 'default'> & { item: Item; default: ValuesOf<Item>[] } {
  return {
    label: '',
    min: 0,
    max: 50,
    ...options,
    default: options.default ?? [],
    type: 'list',
    item,
  }
}

function custom<V extends JsonValue>(
  component: string,
  options: Opts<Omit<CustomField, 'component' | 'default' | 'type'>> & { default: V }
): Omit<CustomField, 'default'> & { default: V } {
  return { label: '', ...options, type: 'custom', component }
}

export const f = {
  text,
  textarea,
  number,
  boolean,
  select,
  image,
  file,
  link,
  url,
  icon,
  group,
  list,
  custom,
}
