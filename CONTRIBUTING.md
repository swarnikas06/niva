# Contributing to NIVA

Thank you for your interest in contributing to NIVA! NIVA is an open-source, persistent personal AI companion designed to understand context, remember what matters, and help people navigate life with clarity.

---

## 1. Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please treat all contributors and community members with respect, constructive feedback, and professional empathy.

---

## 2. Development Workflow

### 2.1 Branching Strategy
* Main development branch: `main` (or `master`).
* Feature and bug fix branches should branch from `main`:
  ```bash
  git checkout -b feat/your-feature-name
  # or
  git checkout -b fix/issue-description
  ```

### 2.2 Commit Message Conventions
We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:
* `feat:` A new user-facing feature or companion capability.
* `fix:` A bug fix or regression resolution.
* `docs:` Documentation improvements or updates.
* `refactor:` Code changes that neither fix a bug nor add a feature.
* `test:` Adding missing tests or correcting existing tests.
* `chore:` Build process, dependency updates, or auxiliary tool configuration.

Example:
```bash
git commit -m "feat(conversation): add thread-isolated generation cancellation"
```

---

## 3. Pull Request Guidelines

Before opening a pull request, ensure your branch passes all local verification gates:

1. **Static Typecheck**:
   ```bash
   pnpm typecheck
   ```
2. **API Unit & Integration Tests**:
   ```bash
   pnpm --filter @niva/api test
   ```
3. **Security & Credential Check**:
   Ensure no `.env`, API keys, private tokens, or test account credentials are included in your commit:
   ```bash
   git diff --staged
   ```
4. **Documentation**:
   If your change modifies APIs, environment variables, or database schemas, update the relevant files in `docs/`.

---

## 4. Architectural Rules

When contributing to NIVA, keep the following core design invariants in mind:

1. **Zero-Mock Acceptance**: Do not replace real database or service calls with fake mock objects in integration tests. Test against live PostgreSQL/pgvector and Redis containers.
2. **Thread Isolation**: Never use global page-level loading state for conversational generation. Maintain state keyed by conversation ID.
3. **Multi-Tenant Isolation**: Every database query touching user data must strictly filter by `user_id`.
4. **No Therapy Validation Loops**: Companion archetypes must offer constructive forward progression and objective clarity, not repetitive therapist sympathy loops.
