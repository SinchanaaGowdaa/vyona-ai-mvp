import { useEffect, useRef, useState } from 'react';

type User = { id: string; fullName: string; email: string; role: 'superadmin' | 'college_admin' | 'student'; organizationId?: string | null };
type Report = { overallScore: number; summary: string; strengths: string[]; improvements: string[]; rubric: Record<string, number> };
type Interview = { interviewId: string; question: string };
const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('vyona_token') ?? '');
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); const [authMode, setAuthMode] = useState<'login' | 'bootstrap'>('login');
  const [tab, setTab] = useState('overview'); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [collegeName, setCollegeName] = useState(''); const [adminName, setAdminName] = useState(''); const [adminEmail, setAdminEmail] = useState('');
  const [studentName, setStudentName] = useState(''); const [studentEmail, setStudentEmail] = useState(''); const [rollNumber, setRollNumber] = useState(''); const [department, setDepartment] = useState('');
  const [students, setStudents] = useState<any[]>([]); const [colleges, setColleges] = useState<any[]>([]);
  const [interview, setInterview] = useState<Interview | null>(null); const [roleTitle, setRoleTitle] = useState('Software Developer'); const [interviewType, setInterviewType] = useState<'technical' | 'hr'>('technical');
  const [resumeText, setResumeText] = useState(''); const [jobDescription, setJobDescription] = useState('');
  const [answer, setAnswer] = useState(''); const [recording, setRecording] = useState(false); const [report, setReport] = useState<Report | null>(null);
  const [dashboard, setDashboard] = useState<any>(null); const recorder = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]);

  async function request(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !(options.body instanceof Blob) && typeof options.body === 'string') headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok) {
      const data = contentType.includes('json') ? await response.json() : { error: await response.text() };
      throw new Error(data.error ?? 'Request failed.');
    }
    return contentType.includes('json') ? response.json() : response;
  }
  useEffect(() => {
    if (!token) return;
    request('/api/auth/me').then((data) => setUser(data.user)).catch(() => { localStorage.removeItem('vyona_token'); setToken(''); setUser(null); });
  }, [token]);
  useEffect(() => {
    if (!user) return;
    if (user.role === 'college_admin') request('/api/students').then(d => setStudents(d.students)).catch(e => setError(e.message));
    if (user.role === 'superadmin') request('/api/colleges').then(d => setColleges(d.colleges)).catch(e => setError(e.message));
    if (user.role === 'student') request('/api/student/dashboard').then(d => setDashboard(d.dashboard)).catch(e => setError(e.message));
  }, [user]);
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await request(authMode === 'login' ? '/api/auth/login' : '/api/auth/bootstrap-superadmin', { method: 'POST', body: JSON.stringify({ email, password, fullName }) });
      localStorage.setItem('vyona_token', data.token); setToken(data.token); setUser(data.user);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); } finally { setBusy(false); }
  }
  function signOut() { localStorage.removeItem('vyona_token'); setToken(''); setUser(null); setInterview(null); setReport(null); }
  async function createCollege(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await request('/api/colleges', { method: 'POST', body: JSON.stringify({ name: collegeName, adminName, adminEmail }) }); setCollegeName(''); setAdminName(''); setAdminEmail(''); setColleges((await request('/api/colleges')).colleges); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create college.'); } finally { setBusy(false); }
  }
  async function createStudent(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await request('/api/students', { method: 'POST', body: JSON.stringify({ fullName: studentName, email: studentEmail, rollNumber, department }) }); window.alert(`Student created. Temporary password: ${result.temporaryPassword}`); setStudentName(''); setStudentEmail(''); setRollNumber(''); setDepartment(''); setStudents((await request('/api/students')).students); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create student.'); } finally { setBusy(false); }
  }
  async function speak(text: string) {
    try {
      const response = await request('/api/voice/speech', { method: 'POST', body: JSON.stringify({ text }) });
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url); await audio.play();
    } catch { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } }
  }
  async function startInterview(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setReport(null);
    try { const data = await request('/api/interviews', { method: 'POST', body: JSON.stringify({ type: interviewType, roleTitle, resumeText, jobDescription }) }); setInterview(data); setAnswer(''); setTab('live-interview'); void speak(data.question); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start interview.'); } finally { setBusy(false); }
  }
  async function beginRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const media = new MediaRecorder(stream, { mimeType: mime }); recorder.current = media; chunks.current = [];
      media.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      media.onstop = async () => {
        stream.getTracks().forEach(track => track.stop()); setBusy(true);
        try {
          const blob = new Blob(chunks.current, { type: 'audio/webm' });
          const response = await request('/api/voice/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: blob });
          setAnswer((old) => old ? old + ' ' + response.text : response.text);
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not transcribe audio.'); }
        finally { setBusy(false); }
      };
      media.start(); setRecording(true);
    } catch { setError('Microphone access is unavailable. Allow microphone permission or type your answer.'); }
  }
  function stopRecording() { recorder.current?.stop(); setRecording(false); }
  async function submitAnswer() {
    if (!interview || !answer.trim()) return; setBusy(true); setError('');
    try { const data = await request(`/api/interviews/${interview.interviewId}/turn`, { method: 'POST', body: JSON.stringify({ question: interview.question, answer }) }); setInterview({ ...interview, question: data.nextQuestion }); setAnswer(''); void speak(data.nextQuestion); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not submit answer.'); } finally { setBusy(false); }
  }
  async function finishInterview() {
    if (!interview) return; setBusy(true); setError('');
    try { const data = await request(`/api/interviews/${interview.interviewId}/finish`, { method: 'POST', body: JSON.stringify({}) }); setReport(data.report); setInterview(null); setTab('reports'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not evaluate interview.'); } finally { setBusy(false); }
  }
  async function downloadTranscript() {
    if (!interview) return;
    try { const data = await request(`/api/interviews/${interview.interviewId}/transcript`); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'vyona-interview-transcript.json'; a.click(); URL.revokeObjectURL(url); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not download transcript.'); }
  }

  if (!user) return <main className="auth-shell"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark">V</span><div><strong>VYONA AI</strong><small>AI-POWERED CAMPUS PLACEMENT</small></div></div><span className="eyebrow">WELCOME TO YOUR PRACTICE SPACE</span><h1>{authMode === 'login' ? 'Sign in to continue' : 'Set up your superadmin'}</h1><p className="muted">Practice, assess and prepare for your next opportunity.</p><form onSubmit={signIn} className="stack">{authMode === 'bootstrap' && <Field label="Full name" value={fullName} onChange={setFullName} required />}<Field label="Email address" type="email" value={email} onChange={setEmail} required /><Field label="Password" type="password" value={password} onChange={setPassword} required /><button className="primary full" disabled={busy}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create superadmin'}</button></form><button className="text-button auth-switch" onClick={() => setAuthMode(authMode === 'login' ? 'bootstrap' : 'login')}>{authMode === 'login' ? 'First-time superadmin setup' : 'Back to sign in'}</button>{error && <p className="error">{error}</p>}<small className="muted">Superadmin setup works only once and requires matching server environment credentials.</small></section></main>;

  const nav = user.role === 'student' ? ['overview', 'start-interview', 'reports'] : user.role === 'college_admin' ? ['overview', 'students'] : ['overview', 'colleges'];
  return <main className="shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">V</span><div><strong>VYONA AI</strong><small>AI-POWERED CAMPUS PLACEMENT</small></div></div><div className="workspace-label">WORKSPACE</div>{nav.map(item => <button key={item} className={`nav-item ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>{item.replace('-', ' ').replace(/\b\w/g, s => s.toUpperCase())}</button>)}<div className="sidebar-bottom"><span className="avatar">{user.fullName[0]}</span><div><strong>{user.fullName}</strong><small>{user.role.replace('_', ' ')}</small></div><button className="signout" onClick={signOut}>↗</button></div></aside>
    <section className="content"><header className="topbar"><div><span className="eyebrow">YOUR PRACTICE SPACE</span><h1>{tab === 'overview' ? 'Welcome to VYONA AI' : tab.replace('-', ' ').replace(/\b\w/g, s => s.toUpperCase())}</h1></div><span className="role-chip">{user.role.replace('_', ' ')}</span></header>
      {error && <div className="error-banner">{error}<button onClick={() => setError('')}>×</button></div>}
      {tab === 'overview' && <><section className="hero"><div><span className="pill">CAMPUS PLACEMENT WORKSPACE</span><h2>Turn your knowledge<br/>into interview confidence.</h2><p>Practice role-relevant questions, speak with an AI interviewer, and understand your strengths with actionable feedback.</p>{user.role === 'student' && <button className="primary" onClick={() => setTab('start-interview')}>Start an interview <span>↗</span></button>}</div><div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="hero-core">V<span>AI</span></div><div className="float-card card-top">✦ Personalised practice</div><div className="float-card card-bottom">↗ Progress you can track</div></div></section>
        {user.role === 'student' ? <><div className="section-heading"><div><span className="eyebrow">YOUR JOURNEY</span><h2>Assessment progress</h2></div></div><section className="stats"><article className="stat"><span>Interviews completed</span><strong>{dashboard?.completed ?? 0}</strong><small>Evaluated interviews</small></article><article className="stat"><span>Average score</span><strong>{dashboard?.average_score ?? '—'}{dashboard?.average_score != null ? '%' : ''}</strong><small>Across evaluated interviews</small></article><article className="stat"><span>Latest feedback</span><strong className="stat-word">{dashboard?.completed ? 'Available' : 'Not started'}</strong><small>Your report appears after evaluation</small></article></section></> : <section className="section-heading"><div><span className="eyebrow">PILOT WORKSPACE</span><h2>{user.role === 'superadmin' ? 'Manage college workspaces' : 'Manage your students'}</h2></div></section>}</>}
      {tab === 'start-interview' && <section className="panel"><span className="eyebrow">PERSONALISED AI INTERVIEW</span><h2>Prepare your interview</h2><p className="muted">Add your resume and a job description to help VYONA tailor the interview to your experience and target role.</p><form className="stack" onSubmit={startInterview}><label>Interview type<select value={interviewType} onChange={e => setInterviewType(e.target.value as 'technical' | 'hr')}><option value="technical">Technical interview</option><option value="hr">HR interview</option></select></label><Field label="Target role" value={roleTitle} onChange={setRoleTitle} required /><label>Resume text<textarea rows={6} value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder="Paste your resume text here (skills, projects, education and experience)…" /></label><label>Job description (optional)<textarea rows={5} value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Paste the job description to generate blended resume + JD questions…" /></label><button className="primary" disabled={busy}>{busy ? 'Preparing your interviewer…' : 'Start AI voice interview ↗'}</button></form><p className="muted tiny">For this pilot build, paste extracted resume text. PDF/DOCX upload and parsing will be added in the next implementation phase.</p></section>}
      {tab === 'live-interview' && interview && <section className="interview-layout"><div className="interviewer-card"><div className="ai-orb">V<span>AI</span></div><h2>AI Interviewer</h2><p>Listening and responding in real time</p><div className="voice-bars"><i/><i/><i/><i/><i/><i/><i/></div><span className="live-label">● LIVE INTERVIEW</span></div><div className="panel transcript-panel"><div className="panel-title"><div><span className="eyebrow">INTERVIEW TRANSCRIPT</span><h2>{roleTitle}</h2></div><button className="secondary" onClick={downloadTranscript}>Download transcript</button></div><div className="question-bubble"><b>VYONA AI</b><p>{interview.question}</p></div><label>Your answer<textarea rows={5} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Speak your answer using the microphone, or type here…" /></label><div className="answer-actions"><button className={recording ? 'danger' : 'secondary'} onClick={recording ? stopRecording : beginRecording} disabled={busy}>{recording ? '■ Stop recording' : '🎙 Record answer'}</button><button className="primary" onClick={submitAnswer} disabled={busy || !answer.trim()}>{busy ? 'Processing…' : 'Submit answer →'}</button></div><div className="interview-footer"><span className="muted tiny">Your answers are transcribed and evaluated for content, relevance and clarity.</span><button className="text-button" onClick={finishInterview} disabled={busy}>Finish & generate report</button></div></div></section>}
      {tab === 'reports' && <section className="panel"><span className="eyebrow">PLACEMENT ASSESSMENT REPORT</span><h2>AI-powered performance insights</h2>{report ? <><div className="score-panel"><strong>{report.overallScore}</strong><span>/ 100 overall score</span></div><p>{report.summary}</p><div className="report-columns"><div><h3>Strengths</h3>{report.strengths.map(x => <p className="positive" key={x}>✓ {x}</p>)}</div><div><h3>Improvement areas</h3>{report.improvements.map(x => <p className="improve" key={x}>↗ {x}</p>)}</div></div><h3>Performance rubric</h3>{Object.entries(report.rubric).map(([key,value]) => <div className="rubric" key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><b>{value}%</b><div><i style={{width:`${value}%`}}/></div></div>)}</> : <p className="muted">Complete an AI interview to generate your personalised performance report.</p>}</section>}
      {tab === 'colleges' && user.role === 'superadmin' && <><section className="panel"><h2>Create a college workspace</h2><form className="form-grid" onSubmit={createCollege}><Field label="College name" value={collegeName} onChange={setCollegeName} required/><Field label="Admin full name" value={adminName} onChange={setAdminName} required/><Field label="Admin email" type="email" value={adminEmail} onChange={setAdminEmail} required/><button className="primary" disabled={busy}>Create college + admin</button></form><p className="muted tiny">A temporary password is generated for the first college administrator. Securely share it with them.</p></section><section className="panel"><h2>College workspaces</h2>{colleges.map(c => <div className="list-row" key={c.id}><div><b>{c.name}</b><small>{c.slug} · {c.student_count} students</small></div><span className={c.is_active ? 'status-on' : 'status-off'}>{c.is_active ? 'Active' : 'Inactive'}</span></div>)}</section></>}
      {tab === 'students' && user.role === 'college_admin' && <><section className="panel"><h2>Add a student</h2><form className="form-grid" onSubmit={createStudent}><Field label="Full name" value={studentName} onChange={setStudentName} required/><Field label="Email" type="email" value={studentEmail} onChange={setStudentEmail} required/><Field label="Roll number" value={rollNumber} onChange={setRollNumber} required/><Field label="Department" value={department} onChange={setDepartment}/><button className="primary" disabled={busy}>Create student</button></form></section><section className="panel"><h2>Students · {students.length}</h2>{students.map(s => <div className="list-row" key={s.id}><div><b>{s.full_name}</b><small>{s.roll_number} · {s.department ?? 'Department not set'} · {s.email}</small></div><span className="status-on">{s.interview_count} interviews</span></div>)}</section></>}
      <footer>VYONA AI <span>•</span> Practical interview preparation</footer>
    </section>
  </main>;
}
function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label>{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}/></label>;
}
