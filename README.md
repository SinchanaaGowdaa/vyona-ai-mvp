# VYONA AI MVP

A college-pilot platform inspired by the supplied VYONA AI demo: student progress, communication and domain assessments, aptitude/reasoning, a real voice interview, AI evaluation, placement insights, and downloadable transcripts.

## Current implementation

- Neon PostgreSQL + Drizzle schema and migrations.
- Role-based API sessions for superadmin, college admin, and student.
- One-time superadmin bootstrap from server environment credentials.
- Superadmin college creation and college activation/deactivation.
- College-admin student creation and college-scoped student listing.
- Student dashboard summary.
- AI-driven interview question generation and follow-up turns.
- Microphone audio transcription through an OpenAI-compatible speech-to-text endpoint.
- AI interviewer speech audio through text-to-speech.
- Interview answer persistence, AI evaluation rubric, report, and transcript endpoint.

## Stack

- Web: React, Vite, TypeScript
- API: Node.js 20+, Express, TypeScript
- Database: Neon PostgreSQL, Drizzle ORM

## Setup

1. Create a Neon project and copy its pooled connection string.
2. Copy `.env.example` to `apps/api/.env`; set `DATABASE_URL`, a random `SESSION_SECRET` (32+ characters), bootstrap superadmin email/password, and an AI API key.
3. From the repository root run `npm install`, `npm run db:migrate`, then `npm run dev`.
4. Create the first superadmin once by POSTing to `http://localhost:4000/api/auth/bootstrap-superadmin` with the exact email/password configured in the API environment. The endpoint closes after the first superadmin is created. Remove the bootstrap environment values after setup.
5. Sign in through `POST /api/auth/login`. Send the returned token as `Authorization: Bearer <token>` for protected endpoints.

## Main API routes

- `POST /api/auth/bootstrap-superadmin`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST/PATCH /api/colleges` (superadmin)
- `GET/POST /api/students` (college admin)
- `GET /api/student/dashboard` (student)
- `POST /api/interviews`, `POST /api/interviews/:id/turn`, `POST /api/interviews/:id/finish`
- `GET /api/interviews/:id/transcript`
- `POST /api/voice/transcribe` (audio bytes; audio/webm, audio/ogg, audio/wav or audio/mp4)
- `POST /api/voice/speech` (JSON: text)

The interview endpoints accept resume text and a job description at interview creation so the AI can blend candidate-specific and role-specific questions. The browser client still needs to be wired to these endpoints for the complete visual student journey.

## Important pilot limitations

- The API voice endpoints use an OpenAI-compatible API for transcription, interviewer speech and answer evaluation. AI credentials remain server-side.
- The current UI is still a dashboard prototype; the live interview UI, assessments, resume file extraction/storage, report screens, and admin screens must be connected/implemented in the next frontend phase.
- Student creation currently returns a one-time temporary password; deliver it securely and require a password-change flow before real student onboarding.
- Before real student data: add password reset/change, rate limiting, audit logs, secure file storage, retention/deletion rules, privacy notice, HTTPS, backups, and production deployment hardening.
- AI reports are advisory and must not be the sole basis for academic or hiring decisions. Do not score accent, gender, ethnicity, disability, or inferred personality.
