# Security Policy

The NIVA team takes the security and privacy of user data seriously. This document outlines our vulnerability disclosure policy and security protections.

---

## 1. Supported Versions

Security updates and patches are actively applied to the following versions:

| Version | Supported | Notes |
| :--- | :--- | :--- |
| `0.1.x` | :white_check_mark: | Active development & current release branch |
| `< 0.1.0` | :x: | Prototype releases (unsupported) |

---

## 2. Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a potential vulnerability in NIVA, report it responsibly via one of the following channels:

* **Email**: Send detailed vulnerability reports to `security@niva.local` (or reach out to the project maintainer via GitHub profile contact).
* **GitHub Private Vulnerability Reporting**: If enabled on the repository, submit a report via the **Security** tab -> **Report a vulnerability**.

### What to Include in Your Report
To help us triage and resolve the issue quickly, please provide:
1. Description of the vulnerability and affected component (Web, API Gateway, AI Core, Database, Redis).
2. Step-by-step reproduction instructions or a minimal proof of concept.
3. Potential impact (e.g., unauthorized data access, privilege escalation, cross-tenant leak).
4. Any proposed remediations.

### Response Timeline
* **Initial Acknowledgment**: Within 48 hours of receipt.
* **Triage & Assessment**: Within 5 business days.
* **Resolution & Patch**: Coordinated release with reasonable remediation window prior to public disclosure.

---

## 3. Core Security Commitments

NIVA incorporates multiple layers of defense-in-depth:

* **Authentication**: Passwords salted and hashed with Bcrypt (cost factor 12). Dual-token rotation with SHA-256 session tracking and immediate Redis blacklist revocation.
* **Multi-Tenant Protection**: Strict row-level qualification (`user_id = ?`) across all 44 relational tables, preventing Insecure Direct Object References (IDOR).
* **Dual-Network Container Isolation**: Database, Redis, and internal AI endpoints are bound exclusively to an unrouted internal Docker network (`niva-backend-network: internal=true`).
* **Service Authentication**: Inter-service communication between NestJS API and FastAPI AI is authenticated via a cryptographic shared secret header (`X-Niva-Internal-Secret`).
* **User Privacy Rights**: Instant memory revocation (`DELETE /memory/:id`), full JSON data export (`GET /auth/export`), and transactional cascade account deletion (`DELETE /auth/account`).
