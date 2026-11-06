# ADR 0003: AI Provider Abstraction Interface

## Status
Accepted

## Context
Google Gemini is the initial foundational model provider for NIVA. However, hardcoding vendor-specific SDK calls across the codebase would cause vendor lock-in and complicate future multi-model or local model evaluation.

## Decision
We established an abstract base class `AIProvider` in `apps/ai/app/core/provider.py`. The initial implementation `GeminiProvider` implements this contract.

### Contract:
- `generate_text(request: TextGenerationRequest) -> TextGenerationResponse`
- `generate_embeddings(request: EmbeddingRequest) -> EmbeddingResponse`
- `is_configured() -> bool`
- `provider_name -> str`

All agent reasoning workflows and memory extractors in `apps/ai` interact exclusively with `AIProvider`.

## Consequences
- Prevents leakage of Gemini-specific constructs into high-level agent logic.
- Enables pluggable providers and deterministic test mock implementations.
