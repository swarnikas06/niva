# NIVA Security & Isolation Specifications

## Core Security Foundations
1. **User Data Isolation:** Every database query MUST filter by authenticated `user_id`. Frontend-only filtering is prohibited.
2. **Secrets Management:** Zero secrets in client builds. All sensitive API keys reside strictly in server environment configurations.
3. **No Unvalidated LLM DB Writes:** LLM outputs pass through schema validators before any persistence operation is permitted.
4. **Rate Limiting & CORS:** Redis-backed rate limiting protects all public endpoints; CORS is locked to approved client origins.
