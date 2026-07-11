# @pglite-suite/pgvector-demo

A pgvector similarity-search demo, run **entirely in-process with PGlite** — no server, no native extension build.

A `search.documents` table with a `vector(3)` embedding column and an HNSW cosine-distance index. The test registers the `vector` WASM extension at construction (`extensions: { vector }` from `@electric-sql/pglite-pgvector`), deploys the pgpm module, and ranks documents by cosine distance (`embedding <=> $1`).

```bash
pnpm test
```

pgpm's `cleanSql` strips `CREATE EXTENSION` from migrations, so the extension is provisioned out-of-band: registered as a WASM module and installed via `extensionSql`. On a real server the same `CREATE EXTENSION vector` installs the native extension.
