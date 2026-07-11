\echo Use "CREATE EXTENSION pgvector-demo" to load this file. \quit

CREATE SCHEMA search;

CREATE TABLE search.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding vector(3) NOT NULL
);

CREATE INDEX idx_documents_embedding
    ON search.documents
    USING hnsw (embedding vector_cosine_ops);
