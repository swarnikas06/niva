-- ==============================================================================
-- NIVA — PostgreSQL Initialization Script
-- ==============================================================================
-- Ensure pgvector and uuid extensions are active for semantic memory and uuid generation

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
