# ADR 0002: Primary Database & pgvector Selection

## Status
Accepted

## Context
NIVA requires high-reliability relational data storage for transactional user records (conversations, goals, tasks, user profiles) combined with high-dimensional vector search for semantic memory retrieval.

## Decision
We selected **PostgreSQL 16** with the **`pgvector`** extension (`pgvector/pgvector:pg16` Docker image).

### Rationale:
1. **Single Source of Truth:** Unifying relational state and vector embeddings in PostgreSQL eliminates distributed synchronization anomalies between an external vector DB (e.g. Pinecone/Weaviate) and relational storage.
2. **ACID Transactions:** Memory extraction, classification, and vector indexing occur within transactional boundaries.
3. **Filtering & Ownership:** Allows atomic hybrid queries filtering strictly by `user_id`, `category`, and `importance` alongside vector cosine distance (`<=>`).
4. **AWS Compatibility:** Directly migratable to Amazon Aurora PostgreSQL / RDS PostgreSQL with native pgvector support.

## Consequences
- Single database technology to manage, back up, and secure.
- Requires pgvector extension enabled during container initialization (`CREATE EXTENSION IF NOT EXISTS vector;`).
