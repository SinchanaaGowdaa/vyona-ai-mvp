# VYONA AI MVP

A focused college-pilot platform for resume-based technical and HR interview practice, AI evaluation, and performance reports.

## MVP scope

- Superadmin: create colleges and college administrators.
- College admin: add students and review their interview reports.
- Student: upload a resume, complete a structured interview, and view feedback.
- AI evaluation: score answers against role-relevant criteria and provide actionable feedback.

This MVP is intentionally limited to the pilot workflow. Advanced proctoring, mentorship, recruitment marketplace, billing, and complex analytics are out of scope.

## Stack

- Web: React, Vite, TypeScript
- API: Node.js, Express, TypeScript
- Database: PostgreSQL with Drizzle ORM

## Repository structure

```text
apps/
  api/       Express API
  web/       React application
packages/
  shared/    Shared types and validation
```

## Local setup

Prerequisites: Node.js 20+, npm 10+, and PostgreSQL 15+.

1. Copy `.env.example` to `apps/api/.env` and configure the database and secrets.
2. Install dependencies with `npm install`.
3. Run database migrations with `npm run db:migrate`.
4. Start the web and API apps with `npm run dev`.

See each app's README as implementation is added. Never commit real API keys, passwords, or production secrets.

## Pilot safety

Use synthetic student data during development. Before onboarding real students, configure HTTPS, secure backups, retention/deletion rules, access controls, and a privacy notice. AI feedback is advisory and should not be used as the sole basis for academic or hiring decisions.
