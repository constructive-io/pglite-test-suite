-- Verify: embeddings on pg

BEGIN;

SELECT 1 / count(*) FROM pg_extension WHERE extname = 'vector';

SELECT 1 / count(*) FROM information_schema.schemata WHERE schema_name = 'search';

SELECT 1 / count(*) FROM information_schema.tables
WHERE table_schema = 'search' AND table_name = 'documents';

SELECT 1 / count(*) FROM pg_indexes
WHERE schemaname = 'search' AND tablename = 'documents' AND indexname = 'idx_documents_embedding';

ROLLBACK;
