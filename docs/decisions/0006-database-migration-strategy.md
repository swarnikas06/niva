# ADR 0006: Database Migration & ORM Strategy

## Status
Accepted

## Context
NIVA requires a robust database schema migration tool that supports PostgreSQL 16, pgvector column types, strict type safety in NestJS, and deterministic forward/rollback migration capabilities.

## Decision
We establish explicit schema migrations executed via standard SQL / ORM migration tooling.
- For Phase 0, the database connection infrastructure uses native `pg` client pools in `apps/api` for zero-overhead connectivity and health monitoring.
- The schema migration tool will be formalized and executed in **Phase 6 (Database and Persistent User State)** using declarative migration scripts to ensure complete reproducibility across development, staging, and AWS RDS environments.

## Rules:
1. No manual schema modifications are permitted against the database without a corresponding migration script.
2. All migrations must be idempotent and transaction-wrapped.
3. Every user-owned table must declare strict foreign key constraints and `user_id` indexes.
