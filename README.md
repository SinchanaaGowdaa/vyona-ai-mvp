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
- Database: Neon PostgreSQL with Drizzle ORM

## Repository structure

```text
apps/
  api/       Express API
  web/       React application
packages/
  shared/    Shared types and validation
```

## Setup (Neon PostgreSQL — no local PostgreSQL installation required)

1. Create a project in the Neon Console: https://console.neon.tech/ . Choose a region close to your users.
2. In the project dashboard, choose **Connect** and copy the PostgreSQL connection string. Use the pooled connection string for the app and retain `sslmode=require`.
3. Create `apps/api/.env` (not the repository root) and set `DATABASE_URL` to the full Neon connection string. Also set a long random `SESSION_SECRET`. Never commit this file.
4. From the repository root, run `npm install` and then `npm run db:migrate`.
5. Start the web and API apps with `npm run dev`.

Neon connection strings usually select the default database `neondb`; use the database name shown in the copied connection string. Do not replace it with `vyona_ai` unless you explicitly created that database in Neon. The same `DATABASE_URL` is used by Drizzle migrations and the API.

## Pilot safety

Use synthetic student data during development. Before onboarding real students, configure HTTPS, secure backups, retention/deletion rules, access controls, and a privacy notice. AI feedback is advisory and should not be used as the sole basis for academic or hiring decisions.
