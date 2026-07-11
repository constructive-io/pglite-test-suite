-- Revert: embeddings from pg

BEGIN;

DROP INDEX IF EXISTS search.idx_documents_embedding;
DROP TABLE IF EXISTS search.documents;
DROP SCHEMA IF EXISTS search;
DROP EXTENSION IF EXISTS vector;

COMMIT;
