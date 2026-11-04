import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { pool } from './db/index.js';

type Session = { id: string; role: 'superadmin' | 'college_admin' | 'student'; organizationId: string | null; exp: number };
type AuthedRequest = Request & { user?: Session };
const app = express();
const port = Number(process.env.PORT ?? 4000);
const sessionSecret = process.env.SESSION_SECRET;
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function signSession(user: Omit<Session, 'exp'>) {
  if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token || !sessionSecret) return res.status(401).json({ error: 'Sign in required.' });
    const [payload, signature] = token.split('.');
    const expected = createHmac('sha256', sessionSecret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Invalid session.' });
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    if (session.exp < Date.now()) return res.status(401).json({ error: 'Session expired. Sign in again.' });
    req.user = session;
    next();
  } catch { return res.status(401).json({ error: 'Invalid session.' }); }
}
function allow(...roles: Session['role'][]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to do this.' });
    next();
  };
}
function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 170);
}
function makeTempPassword() { return randomBytes(9).toString('base64url'); }
async function aiChat(messages: Array<{ role: string; content: string }>, temperature = 0.5) {
  if (!process.env.AI_API_KEY) throw new Error('AI_API_KEY is not configured. Add your AI provider key to apps/api/.env.');
  const base = (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.AI_MODEL ?? 'gpt-4o-mini', messages, temperature })
  });
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? 'AI provider request failed.');
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}
function parseJson<T>(value: string): T {
  const cleaned = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as T;
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'vyona-api' }));
app.get('/api', (_req, res) => res.json({ name: 'VYONA AI API', version: '0.2.0', features: ['college-management', 'student-management', 'ai-voice-interviews', 'evaluation', 'transcripts'] }));

// First-run bootstrap. Configure both values in the server environment; this endpoint closes after one superadmin exists.
app.post('/api/auth/bootstrap-superadmin', async (req, res) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    if (!process.env.BOOTSTRAP_SUPERADMIN_EMAIL || !process.env.BOOTSTRAP_SUPERADMIN_PASSWORD) return res.status(403).json({ error: 'Superadmin bootstrap is not configured.' });
    if (email !== process.env.BOOTSTRAP_SUPERADMIN_EMAIL.toLowerCase() || password !== process.env.BOOTSTRAP_SUPERADMIN_PASSWORD) return res.status(403).json({ error: 'Bootstrap credentials do not match server configuration.' });
    const existing = await pool.query("select id from users where role = 'superadmin' limit 1");
    if (existing.rowCount) return res.status(409).json({ error: 'A superadmin already exists. Use sign in.' });
    const name = String(req.body.fullName ?? 'VYONA Superadmin').trim().slice(0, 120);
    const created = await pool.query("insert into users (role, full_name, email, password_hash) values ('superadmin', $1, $2, $3) returning id, role, organization_id", [name, email, passwordHash(password)]);
    const user = created.rows[0];
    return res.status(201).json({ token: signSession({ id: user.id, role: user.role, organizationId: user.organization_id }), user: { id: user.id, fullName: name, email, role: user.role } });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Bootstrap failed.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const result = await pool.query('select id, organization_id, role, full_name, email, password_hash, is_active from users where lower(email) = $1 limit 1', [email]);
    const user = result.rows[0];
    if (!user || !user.is_active || !verifyPassword(String(req.body.password ?? ''), user.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
    if (user.organization_id) {
      const org = await pool.query('select is_active from organizations where id = $1', [user.organization_id]);
      if (!org.rows[0]?.is_active) return res.status(403).json({ error: 'Your college workspace is inactive.' });
    }
    return res.json({ token: signSession({ id: user.id, role: user.role, organizationId: user.organization_id }), user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role, organizationId: user.organization_id } });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Sign in failed.' }); }
});

app.get('/api/auth/me', authenticate, async (req: AuthedRequest, res) => {
  const result = await pool.query('select id, full_name, email, role, organization_id from users where id = $1 and is_active = true', [req.user!.id]);
  if (!result.rows[0]) return res.status(401).json({ error: 'Account is no longer active.' });
  const u = result.rows[0];
  res.json({ user: { id: u.id, fullName: u.full_name, email: u.email, role: u.role, organizationId: u.organization_id } });
});

// Superadmin: college records and their first administrator.
app.get('/api/colleges', authenticate, allow('superadmin'), async (_req, res) => {
  const result = await pool.query('select o.id, o.name, o.slug, o.is_active, o.created_at, count(u.id)::int as student_count from organizations o left join users u on u.organization_id = o.id and u.role = $1 group by o.id order by o.created_at desc', ['student']);
  res.json({ colleges: result.rows });
});
app.post('/api/colleges', authenticate, allow('superadmin'), async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const adminName = String(req.body.adminName ?? '').trim();
  const adminEmail = String(req.body.adminEmail ?? '').trim().toLowerCase();
  if (name.length < 2 || adminName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return res.status(400).json({ error: 'College name, administrator name and valid email are required.' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const org = await client.query('insert into organizations (name, slug) values ($1, $2) returning id, name, slug', [name, `${slugify(name)}-${randomBytes(3).toString('hex')}`]);
    const tempPassword = makeTempPassword();
    const admin = await client.query("insert into users (organization_id, role, full_name, email, password_hash) values ($1, 'college_admin', $2, $3, $4) returning id", [org.rows[0].id, adminName, adminEmail, passwordHash(tempPassword)]);
    await client.query('commit');
    res.status(201).json({ college: org.rows[0], administratorId: admin.rows[0].id, temporaryPassword: tempPassword });
  } catch (error) { await client.query('rollback'); res.status(400).json({ error: error instanceof Error ? error.message : 'Could not create college.' }); }
  finally { client.release(); }
});
app.patch('/api/colleges/:id', authenticate, allow('superadmin'), async (req, res) => {
  const fields: string[] = []; const values: unknown[] = [];
  if (typeof req.body.name === 'string' && req.body.name.trim()) { values.push(req.body.name.trim()); fields.push(`name = $${values.length}`); }
  if (typeof req.body.isActive === 'boolean') { values.push(req.body.isActive); fields.push(`is_active = $${values.length}`); }
  if (!fields.length) return res.status(400).json({ error: 'No supported changes supplied.' });
  values.push(req.params.id);
  const result = await pool.query(`update organizations set ${fields.join(', ')}, updated_at = now() where id = $${values.length} returning id, name, slug, is_active`, values);
  if (!result.rows[0]) return res.status(404).json({ error: 'College not found.' });
  res.json({ college: result.rows[0] });
});

// College admin: create students and review only their own college.
app.get('/api/students', authenticate, allow('college_admin'), async (req: AuthedRequest, res) => {
  const result = await pool.query(`select u.id, u.full_name, u.email, sp.roll_number, sp.department, sp.graduation_year,
    (select count(*)::int from interviews i where i.student_id = sp.id) as interview_count
    from users u join student_profiles sp on sp.user_id = u.id where u.organization_id = $1 and u.role = 'student' order by u.full_name`, [req.user!.organizationId]);
  res.json({ students: result.rows });
});
app.post('/api/students', authenticate, allow('college_admin'), async (req: AuthedRequest, res) => {
  const fullName = String(req.body.fullName ?? '').trim(); const email = String(req.body.email ?? '').trim().toLowerCase();
  const rollNumber = String(req.body.rollNumber ?? '').trim(); const department = String(req.body.department ?? '').trim();
  if (fullName.length < 2 || !rollNumber || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Name, valid email and roll number are required.' });
  const tempPassword = makeTempPassword(); const client = await pool.connect();
  try {
    await client.query('begin');
    const u = await client.query("insert into users (organization_id, role, full_name, email, password_hash) values ($1, 'student', $2, $3, $4) returning id", [req.user!.organizationId, fullName, email, passwordHash(tempPassword)]);
    await client.query('insert into student_profiles (user_id, roll_number, department, graduation_year) values ($1, $2, $3, $4)', [u.rows[0].id, rollNumber, department || null, req.body.graduationYear ? Number(req.body.graduationYear) : null]);
    await client.query('commit');
    res.status(201).json({ student: { id: u.rows[0].id, fullName, email, rollNumber }, temporaryPassword: tempPassword });
  } catch (error) { await client.query('rollback'); res.status(400).json({ error: error instanceof Error ? error.message : 'Could not create student.' }); }
  finally { client.release(); }
});
app.get('/api/student/dashboard', authenticate, allow('student'), async (req: AuthedRequest, res) => {
  const result = await pool.query(`select sp.id as student_id, u.full_name, u.email, sp.roll_number, sp.department,
    (select count(*)::int from interviews i where i.student_id = sp.id and i.status = 'evaluated') as completed,
    (select round(avg(r.overall_score))::int from interviews i join interview_reports r on r.interview_id = i.id where i.student_id = sp.id) as average_score
    from users u join student_profiles sp on sp.user_id = u.id where u.id = $1`, [req.user!.id]);
  res.json({ dashboard: result.rows[0] ?? null });
});

async function studentProfileId(userId: string) {
  const result = await pool.query('select id from student_profiles where user_id = $1', [userId]);
  return result.rows[0]?.id as string | undefined;
}
app.post('/api/interviews', authenticate, allow('student'), async (req: AuthedRequest, res) => {
  try {
    const studentId = await studentProfileId(req.user!.id);
    if (!studentId) return res.status(404).json({ error: 'Student profile not found.' });
    const roleTitle = String(req.body.roleTitle ?? 'Graduate Trainee').trim().slice(0, 160);
    const resumeText = String(req.body.resumeText ?? '').slice(0, 12000);
    const jobDescription = String(req.body.jobDescription ?? '').slice(0, 8000);
    const type = req.body.type === 'hr' ? 'hr' : 'technical';
    const created = await pool.query('insert into interviews (student_id, type, role_title) values ($1, $2, $3) returning id', [studentId, type, roleTitle]);
    const interviewId = created.rows[0].id as string;
    const question = await aiChat([
      { role: 'system', content: 'You are VYONA AI, a warm but rigorous campus placement interviewer. Ask exactly one clear spoken interview question. Do not give the answer. Keep it under 45 words.' },
      { role: 'user', content: `Interview type: ${type}. Target role: ${roleTitle}. Candidate resume: ${resumeText || 'Not supplied'}. Job description: ${jobDescription || 'Not supplied'}. Ask a relevant opening question.` }
    ]);
    res.status(201).json({ interviewId, question });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Could not start interview.' }); }
});
app.post('/api/interviews/:id/turn', authenticate, allow('student'), async (req: AuthedRequest, res) => {
  try {
    const studentId = await studentProfileId(req.user!.id);
    const owned = await pool.query("select id, role_title, type from interviews where id = $1 and student_id = $2 and status = 'in_progress'", [req.params.id, studentId]);
    if (!owned.rows[0]) return res.status(404).json({ error: 'Active interview not found.' });
    const question = String(req.body.question ?? '').trim(); const answer = String(req.body.answer ?? '').trim();
    if (!question || !answer) return res.status(400).json({ error: 'Question and answer are required.' });
    const seq = await pool.query('select coalesce(max(sequence), 0)::int + 1 as next from interview_answers where interview_id = $1', [req.params.id]);
    await pool.query('insert into interview_answers (interview_id, question, answer, sequence) values ($1, $2, $3, $4)', [req.params.id, question, answer, seq.rows[0].next]);
    const history = await pool.query('select question, answer from interview_answers where interview_id = $1 order by sequence', [req.params.id]);
    const messages = [{ role: 'system', content: `You are VYONA AI conducting a ${owned.rows[0].type} interview for ${owned.rows[0].role_title}. Ask one follow-up or next question based on the candidate's answers. Do not reveal scores or ideal answers. Be professional, supportive, and concise. If enough coverage after 6-8 questions, ask one final closing question.` }, ...history.rows.flatMap((r: { question: string; answer: string }) => [{ role: 'assistant', content: r.question }, { role: 'user', content: r.answer }])];
    const nextQuestion = await aiChat(messages, 0.65);
    res.json({ nextQuestion, answered: history.rowCount });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Could not process interview response.' }); }
});
app.post('/api/interviews/:id/finish', authenticate, allow('student'), async (req: AuthedRequest, res) => {
  try {
    const studentId = await studentProfileId(req.user!.id);
    const owned = await pool.query("select id from interviews where id = $1 and student_id = $2 and status = 'in_progress'", [req.params.id, studentId]);
    if (!owned.rows[0]) return res.status(404).json({ error: 'Active interview not found.' });
    const answers = await pool.query('select question, answer, sequence from interview_answers where interview_id = $1 order by sequence', [req.params.id]);
    if (!answers.rowCount) return res.status(400).json({ error: 'Answer at least one question before submitting.' });
    const raw = await aiChat([
      { role: 'system', content: 'Evaluate this interview fairly. Return ONLY valid JSON with keys overallScore (integer 0-100), summary (string), strengths (array of 3 concise strings), improvements (array of 3 actionable strings), rubric (object with communication, relevance, technicalAccuracy, structure, confidence integer scores 0-100). Do not infer accent, gender, ethnicity, disability or personality. Score only answer content.' },
      { role: 'user', content: JSON.stringify(answers.rows) }
    ], 0.2);
    const report = parseJson<{ overallScore: number; summary: string; strengths: string[]; improvements: string[]; rubric: Record<string, number> }>(raw);
    const score = Math.max(0, Math.min(100, Math.round(report.overallScore)));
    await pool.query("insert into interview_reports (interview_id, overall_score, strengths, improvements, summary, rubric) values ($1, $2, $3, $4, $5, $6) on conflict (interview_id) do update set overall_score = excluded.overall_score, strengths = excluded.strengths, improvements = excluded.improvements, summary = excluded.summary, rubric = excluded.rubric", [req.params.id, score, JSON.stringify(report.strengths), JSON.stringify(report.improvements), report.summary, JSON.stringify(report.rubric)]);
    await pool.query("update interviews set status = 'evaluated', submitted_at = now() where id = $1", [req.params.id]);
    res.json({ report: { ...report, overallScore: score } });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Could not evaluate interview.' }); }
});
app.get('/api/interviews/:id/transcript', authenticate, allow('student'), async (req: AuthedRequest, res) => {
  const studentId = await studentProfileId(req.user!.id);
  const interview = await pool.query('select id, role_title, type, started_at, status from interviews where id = $1 and student_id = $2', [req.params.id, studentId]);
  if (!interview.rows[0]) return res.status(404).json({ error: 'Interview not found.' });
  const answers = await pool.query('select question, answer, sequence from interview_answers where interview_id = $1 order by sequence', [req.params.id]);
  const report = await pool.query('select overall_score, strengths, improvements, summary, rubric from interview_reports where interview_id = $1', [req.params.id]);
  res.json({ interview: interview.rows[0], answers: answers.rows, report: report.rows[0] ?? null });
});

// Voice services: browser records microphone audio; server performs transcription and AI speech generation.
app.post('/api/voice/transcribe', authenticate, allow('student'), express.raw({ type: ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4'], limit: '18mb' }), async (req, res) => {
  try {
    if (!process.env.AI_API_KEY) return res.status(503).json({ error: 'AI_API_KEY is not configured.' });
    if (!Buffer.isBuffer(req.body) || req.body.length < 100) return res.status(400).json({ error: 'Audio recording is empty.' });
    const form = new FormData();
    form.append('model', process.env.AI_STT_MODEL ?? 'whisper-1');
    form.append('file', new Blob([req.body], { type: req.header('content-type') ?? 'audio/webm' }), 'answer.webm');
    const base = (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await fetch(`${base}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` }, body: form });
    const data = await response.json() as { text?: string; error?: { message?: string } };
    if (!response.ok) return res.status(502).json({ error: data.error?.message ?? 'Speech transcription failed.' });
    res.json({ text: data.text ?? '' });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Transcription failed.' }); }
});
app.post('/api/voice/speech', authenticate, allow('student'), async (req, res) => {
  try {
    if (!process.env.AI_API_KEY) return res.status(503).json({ error: 'AI_API_KEY is not configured.' });
    const text = String(req.body.text ?? '').trim().slice(0, 4000);
    if (!text) return res.status(400).json({ error: 'Speech text is required.' });
    const base = (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await fetch(`${base}/audio/speech`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.AI_TTS_MODEL ?? 'tts-1', voice: process.env.AI_TTS_VOICE ?? 'nova', input: text, response_format: 'mp3' }) });
    if (!response.ok) { const detail = await response.text(); return res.status(502).json({ error: detail.slice(0, 500) || 'AI speech generation failed.' }); }
    res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Cache-Control', 'no-store');
    response.body?.pipeTo(WritableStream ? new WritableStream({ write(chunk) { res.write(Buffer.from(chunk)); }, close() { res.end(); } }) : undefined as never).catch(() => res.end());
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Speech generation failed.' }); }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error.' });
});
app.listen(port, () => console.log(`VYONA API listening on http://localhost:${port}`));
