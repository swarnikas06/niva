# NIVA API Documentation

## Endpoints Overview (Phase 0)

| Method | Route | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health/live` | Liveness probe (process health) | No |
| `GET` | `/api/v1/health/ready` | Readiness probe (Postgres, Redis, AI service) | No |
| `GET` | `/api-docs` | Interactive Swagger / OpenAPI 3.0 Documentation | No |

## Interactive Documentation
Run `pnpm dev:api` and navigate to [http://localhost:4000/api-docs](http://localhost:4000/api-docs).
