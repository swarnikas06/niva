-- ==============================================================================
-- Migration 0007: Allow 'deferred' in memory_candidates status check constraint
-- NIVA Phase 3C: Memory Evaluation, Lifecycle, Deduplication & Durable Knowledge
-- ==============================================================================

ALTER TABLE memory_candidates DROP CONSTRAINT IF EXISTS memory_candidates_status_check;

ALTER TABLE memory_candidates ADD CONSTRAINT memory_candidates_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'failed', 'deferred'));
