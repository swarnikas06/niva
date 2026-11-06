# NIVA Local Development Guide

This guide walks you through setting up and running the NIVA monorepo locally for development and testing.

---

## 1. Prerequisites

Ensure the following tools are installed on your workstation:

* **Node.js**: `v20.12.0` or higher (LTS recommended)
* **Corepack / pnpm**: `pnpm@10.23.0`
  ```bash
  corepack enable
  corepack prepare pnpm@10.23.0 --activate
  ```
* **Python**: `v3.12+` (with `venv` and `pip`)
* **Docker & Docker Compose**: Docker Desktop (Windows/macOS) or Docker Engine with compose plugin (Linux)
* **Google Gemini API Key**: Free-tier API key from [Google AI Studio](https://aistudio.google.com/)

---

## 2. Quickstart (Clone & Dependencies)

### Step 1: Clone the Repository
```bash
git clone https://github.com/swarnikas06/niva.git
cd niva
```

### Step 2: Install Node.js Dependencies
```bash
pnpm install
```

### Step 3: Set Up Python AI Virtual Environment
```bash
# Navigate to the AI service
cd apps/ai

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Install AI dependencies
pip install -r requirements.txt

# Return to repository root
cd ../..
```

---

## 3. Environment Configuration

### Step 1: Create Local Environment File
Copy the provided `.env.example` template:
```bash
# Windows PowerShell:
Copy-Item .env.example .env
# Linux / macOS:
cp .env.example .env
```

### Step 2: Configure Keys in `.env`
Open `.env` in your editor and configure the necessary variables:
```dotenv
# Essential Configuration
NODE_ENV=development
API_PORT=4000
WEB_PORT=3000
AI_PORT=8000

# Database & Redis (Local Docker defaults)
DATABASE_URL=postgresql://niva_user:niva_dev_password_local_only@localhost:5432/niva_db?schema=public
REDIS_URL=redis://localhost:6379

# Google Gemini API Key (Required for AI generation & embeddings)
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio

# Application Security
JWT_SECRET=development_jwt_secret_must_be_at_least_32_characters_long
COOKIE_SECRET=development_cookie_secret_32_chars_minimum
INTERNAL_SERVICE_SECRET=development_shared_internal_secret_for_niva
```

---

## 4. Database Setup & Migrations

### Step 1: Start PostgreSQL and Redis Containers
Use the development Docker Compose specification to start PostgreSQL (with pgvector) and Redis:
```bash
docker compose up -d postgres redis
```

Verify that the databases are healthy:
```bash
docker compose ps
```

### Step 2: Run Database Migrations
Apply Drizzle ORM migrations to instantiate all 44 tables and vector indexes:
```bash
pnpm --filter @niva/api db:migrate
```

---

## 5. Starting the Development Services

Run each service in a separate terminal:

### Terminal 1: NestJS API Gateway
```bash
pnpm dev:api
# Running on http://localhost:4000/api/v1
```

### Terminal 2: Python FastAPI Intelligence Core
```bash
# Windows:
.\apps\ai\.venv\Scripts\python -m uvicorn app.main:app --app-dir apps/ai --port 8000 --reload
# Linux / macOS:
source apps/ai/.venv/bin/activate && uvicorn app.main:app --app-dir apps/ai --port 8000 --reload
# Running on http://localhost:8000
```

### Terminal 3: Next.js Frontend Web Application
```bash
pnpm dev:web
# Running on http://localhost:3000
```

Open `http://localhost:3000` in your browser.

---

## 6. Running Production Container Topology Locally

To test the production-grade multi-container topology using pre-built optimized containers:

```bash
# 1. Build and start production stack
docker compose -f docker-compose.prod.yml up -d --build

# 2. View running containers
docker ps

# 3. Check aggregate logs
docker compose -f docker-compose.prod.yml logs -f

# 4. Stop production stack
docker compose -f docker-compose.prod.yml down
```

---

## 7. Useful Monorepo Commands

| Command | Action |
| :--- | :--- |
| `pnpm build` | Compiles shared packages, API, and Next.js frontend |
| `pnpm typecheck` | Runs TypeScript compilation verification across all workspaces |
| `pnpm test` | Runs Jest unit and integration tests across NestJS API modules |
| `pnpm lint` | Runs ESLint across all TypeScript packages |
| `pnpm ci:local` | Executes local typecheck and dependency vulnerability audits |
