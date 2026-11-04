# VYONA API

Express API for the VYONA AI pilot. The API uses Neon PostgreSQL and Drizzle ORM.

## Database setup

1. Create a Neon project at https://console.neon.tech/ .
2. Copy the connection string from **Connect**. Prefer the pooled connection string and keep SSL enabled (`sslmode=require`).
3. Put it in `apps/api/.env` as `DATABASE_URL=...`. Do not commit `.env`.
4. Run `npm run db:migrate` from the repository root.

Neon commonly names its default database `neondb`. Keep the database name present in your Neon connection string unless you created another database yourself. A local PostgreSQL server is not required.

## API endpoints currently scaffolded

- Health check: `GET /api/health`
- API metadata: `GET /api`

Authentication, tenant-scoped administration, resume storage, interview sessions, and evaluation routes are not implemented yet; this API scaffold is not ready for real student data.
