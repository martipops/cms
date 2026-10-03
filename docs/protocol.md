# Commit protocol

Types live in `@martipops/cms-core` (`protocol.ts`), so client and server can't drift apart. Changing this protocol means updating this document and both packages together.

## Request

```http
POST /admin/cms/commit
Content-Type: application/json
X-XSRF-TOKEN: …

{ "ops": [ … ] }
```

The request holds 1 to 200 ops. They're validated together and applied **in order**, in one transaction.

## Ops

### `section.save`

```json
{
  "type": "section.save",
  "page": "home",
  "section": "hero",
  "changes": { "title": "Hot pie" },
  "reset": ["image"]
}
```

- `changes` sets fields. Values are validated against each field. `null` is a real value (for example, no image), not a reset.
- `reset` removes edits, so those fields show their code defaults again.
- Fields not mentioned keep their current stored edit.

### `doc.create`

```json
{
  "type": "doc.create",
  "collection": "specials",
  "ref": "new-1",
  "data": { "title": "Half-price Tuesdays", "schedule": "Tuesday", "description": "…" }
}
```

- Missing fields get their defaults. Then the whole item is validated.
- `ref` is a client-chosen name. Later ops in the same commit (only `doc.reorder` today) can use it in place of the id, and the response maps it to the new id.
- The new item goes last, unless a reorder in the same commit says otherwise.

### `doc.update`

```json
{
  "type": "doc.update",
  "collection": "locations",
  "id": 3,
  "data": { "phone": "502-555-0100" },
  "hidden": false
}
```

- `data` holds only the changed fields. They're merged into the stored item, and the **merged** item is validated.
- `hidden` changes visibility (needs `allow.hide`). Either key may be omitted.

### `doc.delete`

```json
{ "type": "doc.delete", "collection": "specials", "id": 7 }
```

This needs `allow.delete`. Deleting an item that's already gone is a no-op.

### `doc.reorder`

```json
{ "type": "doc.reorder", "collection": "specials", "ids": [8, "new-1", 5, 6] }
```

This needs `allow.reorder`. `ids` must list **every** item in the collection after this commit's creates and deletes, with new items by `ref`. Otherwise the commit fails with "The list of … changed. Reload and try again". That protects against reordering a list someone else changed in the meantime.

## Responses

**Success**

```json
200 { "created": { "new-1": { "id": 12, "slug": null } } }
```

**Validation failure.** Nothing was saved:

```json
422 {
  "message": "Choose a file from the media library",
  "errors": [
    { "op": 0, "path": "image", "message": "Choose a file from the media library" },
    { "op": 2, "path": "hours.0.opens", "message": "The opens field format is invalid" },
    { "op": 3, "path": "", "message": "Locations can't be deleted" }
  ]
}
```

- `op` is the index into the request's `ops`.
- `path` is a field path inside that op's data: dotted, with list indexes (`stats.0.value`). An empty path means the op itself.
- The client maps `op` back to the draft it came from and shows each message on its field.

**Not allowed:** `403 { "message": "Not allowed" }`. **Not signed in:** whatever the route's auth middleware does (a redirect to login here).

## History

```http
GET /admin/cms/history?page=home&section=hero
GET /admin/cms/history?collection=locations&id=3
```

```json
{
  "data": [
    {
      "id": 41,
      "action": "save",
      "data": { "title": "Hot pie" },
      "hidden": null,
      "user": "Sam",
      "createdAt": "2026-10-02T21:14:03.000Z"
    }
  ]
}
```

| Kind     | `data` snapshot                                                     | Restoring it                       |
| -------- | ------------------------------------------------------------------- | ---------------------------------- |
| Section  | The **sparse** edits after the save (`{}` = everything at defaults) | Set those fields, reset all others |
| Document | The **full** item after the save (`null` for a delete)              | Set every field, and visibility    |

Restores are staged as drafts, so the editor previews them, and the next commit writes them as an ordinary save, which gets its own history entry.

## Worked example: one Save

An editor changes the hero title, adds a special, hides another and drags the new one to the top. One click on Save sends:

```json
{
  "ops": [
    {
      "type": "section.save",
      "page": "home",
      "section": "hero",
      "changes": { "title": "Hot pie" },
      "reset": []
    },
    {
      "type": "doc.create",
      "collection": "specials",
      "ref": "new-1",
      "data": {
        "title": "Wing Wednesday",
        "schedule": "Wednesday",
        "description": "…",
        "imageKey": null
      }
    },
    { "type": "doc.update", "collection": "specials", "id": 6, "hidden": true },
    { "type": "doc.reorder", "collection": "specials", "ids": ["new-1", 5, 6, 7, 8] }
  ]
}
```

Either all four happen, or none do.
