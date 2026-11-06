# NIVA Deployment Architecture

## Local Development (Phase 0)
- **Frontend (Next.js):** `http://localhost:3000`
- **Core API (NestJS):** `http://localhost:4000`
- **AI Service (FastAPI):** `http://localhost:8000`
- **PostgreSQL 16 (pgvector):** `localhost:5432` (Docker)
- **Redis 7.2:** `localhost:6379` (Docker)

## AWS Target Architecture (Scheduled for Phase 20)
- **Frontend:** AWS CloudFront + S3 / AWS Amplify
- **Core API:** AWS ECS Fargate
- **AI Service:** AWS ECS Fargate
- **Database:** Amazon RDS PostgreSQL (pgvector enabled)
- **Cache / Queue:** Amazon ElastiCache Redis
- **Secrets:** AWS Secrets Manager
