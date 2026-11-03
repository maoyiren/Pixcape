# Editor Cloud Documents

## Scope

Cloud editor documents are separate from wardrobe assets, outfits, and the cross-tool workspace pointer. A document stores the editable 64×64 canvas and its ordered layers. The workspace continues to store only the currently selected tool and asset/outfit pointers.

## Ownership and access

- Every document has one `ownerId`, derived from the authenticated server session.
- The API never accepts a client-supplied owner ID.
- List, read, update, and delete queries are scoped to the authenticated actor.
- A document owned by another account is returned as not found.
- Deleting a user cascades to that user's documents.

## Stored payload

The version 1 payload is serialized as a string in the database for consistent PostgreSQL, MySQL, and SQLite behavior:

```ts
type EditorDocumentV1 = {
  version: 1
  width: 64
  height: 64
  activeId: string | null
  layers: Array<{
    id: string
    name: string
    visible: boolean
    opacity: number
    pixels: string[] // exactly 4096 entries; empty string or #RRGGBB
  }>
}
```

Limits enforced by the API:

- Canvas dimensions must be 64×64.
- One to 24 layers per document.
- Layer IDs are non-empty and at most 128 characters.
- Layer names are at most 80 characters.
- Opacity is an integer from 0 to 100.
- The serialized document is at most 2 MiB.
- The streamed request body is bounded before JSON parsing.

## API

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/editor-documents` | List up to 50 documents, newest first |
| POST | `/api/editor-documents` | Create a private document |
| GET | `/api/editor-documents/:documentId` | Read a private document |
| PUT | `/api/editor-documents/:documentId` | Update using the expected revision |
| DELETE | `/api/editor-documents/:documentId` | Delete an owned document |

Updates use optimistic concurrency. The client sends the revision it last read; the server increments it atomically. A stale update returns HTTP 409 and must not overwrite the newer document.

## Client behavior

- Browser local storage remains an offline recovery cache.
- A valid local draft takes precedence over automatic workspace asset restoration.
- Cloud documents are explicitly saved and opened; selecting a document does not implicitly overwrite it.
- Cloud deletion requires confirmation and does not delete the local recovery draft.
- Automatic cloud save is intentionally deferred until dirty-state tracking, conflict recovery, and retry behavior can be implemented without silently overwriting remote edits.

## Database rollout

The `EditorDocument` model and SQL migration are maintained for all supported database providers:

- PostgreSQL: `prisma/schema.prisma` and `prisma/migrations/`
- MySQL: `prisma/schema.mysql.prisma` and `prisma/migrations-mysql/`
- SQLite: `prisma/schema.sqlite.prisma` and `prisma/migrations-sqlite/`

The document payload is stored as text (`TEXT` / `LONGTEXT`) rather than a provider-specific JSON column.
