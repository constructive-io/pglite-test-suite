-- Deploy: embeddings to pg
-- made with <3 @ constructive.io

BEGIN;

-- The `vector` extension is a WASM extension in PGlite. pgpm's cleanSql strips
-- `CREATE EXTENSION` from migrations, so it is provisioned out-of-band: the test
-- registers the WASM module at construction (`extensions: { vector }`) and runs
-- `CREATE EXTENSION vector` at bootstrap. On a real server this same line just
-- installs the native extension.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA search;

CREATE TABLE search.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding vector(3) NOT NULL
);

-- Approximate nearest-neighbour index over cosine distance.
CREATE INDEX idx_documents_embedding
    ON search.documents
    USING hnsw (embedding vector_cosine_ops);

COMMIT;
