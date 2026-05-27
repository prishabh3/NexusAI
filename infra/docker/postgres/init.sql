-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search configuration
CREATE INDEX IF NOT EXISTS idx_trgm ON pg_catalog.pg_class USING gin (relname gin_trgm_ops);
