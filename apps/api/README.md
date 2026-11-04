# VYONA API

Express API for the VYONA AI pilot. The API uses PostgreSQL and Drizzle ORM.

- Health check: `GET /api/health`
- API metadata: `GET /api`

Configure `DATABASE_URL` in `apps/api/.env` before running database commands. Never commit `.env` files or production secrets.

Authentication, tenant-scoped administration, resume storage, interview sessions, and evaluation routes are the next implementation layer; the current server is only the initial scaffold and is not ready for real student data.
