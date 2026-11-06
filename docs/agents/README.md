# NIVA Multi-Agent Architecture

## Internal Orchestration Architecture
```
                         NIVA Orchestrator
                                 │
         ┌───────────────┬───────┴───────┬───────────────┐
         ▼               ▼               ▼               ▼
    Conversation      Memory         Life-State       Safety
       Agent           Agent           Agent          Agent
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
      Career           Study         Planning
       Agent           Agent           Agent
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
     Companion                      Proactive
       Agent                          Agent
```

## Agent Contract Principles
Every specialized agent must define:
1. Strict Pydantic / TypeScript input and output contracts.
2. Explicit permission boundaries.
3. Isolated error recovery and fallbacks.
4. Observable execution metrics and audit logs.
