import { useState } from 'react';

type Role = 'student' | 'college-admin' | 'superadmin';
const roleLabels: Record<Role, string> = { student: 'Student', 'college-admin': 'College Admin', superadmin: 'Superadmin' };

export default function App() {
  const [role, setRole] = useState<Role>('student');
  const [tab, setTab] = useState('overview');
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">V</span><div><strong>VYONA AI</strong><small>INTERVIEW PRACTICE</small></div></div>
      <div className="workspace-label">WORKSPACE</div>
      {(['overview', 'interviews', 'reports', 'students', 'colleges'] as const).map((item) => <button key={item} className={`nav-item ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      <div className="sidebar-bottom"><span className="avatar">S</span><div><strong>Demo User</strong><small>{roleLabels[role]}</small></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><span className="eyebrow">YOUR PRACTICE SPACE</span><h1>{tab === 'overview' ? 'Welcome to VYONA AI' : tab[0].toUpperCase() + tab.slice(1)}</h1></div><select aria-label="Demo role" value={role} onChange={e => setRole(e.target.value as Role)}><option value="student">Student view</option><option value="college-admin">College admin view</option><option value="superadmin">Superadmin view</option></select></header>
      <section className="hero"><div><span className="pill">PILOT WORKSPACE</span><h2>Turn your knowledge<br/>into interview confidence.</h2><p>Practice role-relevant questions, understand your strengths, and improve with clear feedback.</p><button className="primary" onClick={() => setTab('interviews')}>Start an interview <span>↗</span></button></div><div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="hero-core">V<span>AI</span></div><div className="float-card card-top">✦ Personalised practice</div><div className="float-card card-bottom">↗ Progress that you can track</div></div></section>
      <div className="section-heading"><div><span className="eyebrow">YOUR JOURNEY</span><h2>Practice overview</h2></div><span className="muted">Demo data</span></div>
      <section className="stats"><article className="stat"><span>Interviews completed</span><strong>0</strong><small>Ready for your first attempt</small></article><article className="stat"><span>Average score</span><strong>—</strong><small>Appears after evaluation</small></article><article className="stat"><span>Latest feedback</span><strong className="stat-word">Not started</strong><small>Your report will appear here</small></article></section>
      <section className="next-step"><div className="step-icon">✧</div><div><strong>Your next step</strong><p>Upload your resume and choose a technical or HR interview to begin.</p></div><button className="text-button" onClick={() => setTab('interviews')}>Explore interviews →</button></section>
      <footer>VYONA AI <span>•</span> Practical interview preparation</footer>
    </section>
  </main>;
}
