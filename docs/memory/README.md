# NIVA Memory System Architecture

## Overview
NIVA separates ephemeral conversation logs from durable extracted memory.

## Memory Taxonomies
1. `identity`: Core user attributes, name, personality traits, constraints
2. `semantic`: Facts, domain knowledge, preferences
3. `episodic`: Significant past life events and interactions
4. `relationship`: Information about people in user's life (mentors, peers, family)
5. `goals`: Long-term and medium-term objectives
6. `open_loops`: Pending commitments, unanswered questions, follow-ups
7. `career`: Placement status, target roles, interview feedback
8. `learning`: Study topics, strengths, knowledge gaps

## Retrieval Pipeline (Scheduled for Phase 7)
`User Query -> Query Intent & Signals -> Hybrid Retrieval (pgvector Cosine Distance + Recency Decay + Importance Weight + User Ownership Filter) -> Companion Context Window`
