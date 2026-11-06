# ADR 0004: Cross-Service API Contract & Serialization Strategy

## Status
Accepted

## Context
In a polyglot system (TypeScript NestJS API and Python FastAPI AI Service), TypeScript interfaces cannot be imported directly into Python.

## Decision
We enforce a multi-layer contract strategy:
1. **OpenAPI / JSON Schema:** Both NestJS (`@nestjs/swagger`) and FastAPI (`/openapi.json`) expose standards-compliant OpenAPI 3.0 schemas.
2. **DTO & Model Validation:** 
   - NestJS uses `class-validator` and `zod` (`packages/validation`).
   - FastAPI uses `pydantic` v2 models.
3. **Automated Integration Tests:** HTTP contract tests verify serialization formats between API and AI service without relying on manual type duplication.
4. **Standard Envelope Contract:** All user-facing endpoints conform to `@niva/shared-types` `ApiResponse<T>` envelope format.

## Consequences
- No runtime type drift between microservices.
- Clear contract boundaries without tight compilation coupling.
