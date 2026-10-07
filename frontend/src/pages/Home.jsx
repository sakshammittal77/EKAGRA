import { useEffect, useMemo, useRef, useState } from 'react';
import { THEMES } from '../data/teachings.js';
import { ThemeGrid } from '../components/Cards.jsx';
import { logQuery, matchQuotes } from '../lib/api.js';
import { setReelDraft, useLibrary } from '../lib/library.js';
import { go } from '../lib/router.js';
import Hero3D from '../fx/Hero3D.jsx';
import Anatomy from '../fx/Anatomy.jsx';
import { GuideHero } from '../components/Guide.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const ASK_EXAMPLES = ["I'm scared of my viva", "I can't stop scrolling", 'Everyone seems smarter', 'I want to help others'];

export function CarePanel({ care }) {
  if (!care) return null;
  return (
    <div className="care-panel" role="alert">
      <strong>{care.title}</strong>
      <p>{care.message}</p>
      <div className="care-lines">
        {care.helplines.map((h) => (
          <a key={h.number} href={`tel:${h.number.replace(/[^0-9]/g, '')}`} className="care-line">
            <b>{h.number}</b> {h.name}
          </a>
        ))}
      </div>
    </div>
  );
}

export function MatchCard({ m, i, onUse, active }) {
  return (
    <article className={`match-card fx-card${active ? ' active' : ''}`} data-spot style={{ '--d': `${i * 0.08}s` }}>
      <div className="match-top">
        <span className="tag">{m.theme}</span>
        <span className="meter" title={`Fit ${m.strength}%`}><i style={{ width: `${Math.max(6, m.strength)}%` }} /></span>
      </div>
      <p className="match-text">“{m.text}”</p>
      <div className="match-foot">
        <a className="match-src" href={m.source_url} target="_blank" rel="noreferrer">Vol. {m.volume} · {m.chapter} ↗</a>
        {onUse && (
          <button type="button" className={`btn ${active ? 'btn-dark' : 'btn-soft'} btn-sm`} onClick={() => onUse(m)}>
            {active ? '✓ Selected' : 'Use this'}
          </button>
        )}
      </div>
    </article>
  );
}

function Ask({ backend }) {
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    clearTimeout(timer.current);
    const q = text.trim();
    if (q.length < 6) { setRes(null); setBusy(false); return undefined; }
    setBusy(true);
    timer.current = setTimeout(() => {
      matchQuotes(q, null, 3).then(setRes).catch(() => setRes({ error: true })).finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(timer.current);
  }, [text]);

  function useMatch(m) {
    const userId = backend?.backendUser?.id;
    if (userId) logQuery(userId, text.trim()).catch(() => {});
    setReelDraft({ situation: text.trim(), teachingId: m.id, theme: m.app_themes?.[0] });
    go('reels/new');
  }

  return (
    <section className="section" id="start">
      <div className="container ask">
        <div className="ask-copy" data-reveal>
          <span className="eyebrow">Start here</span>
          <h2 className="h2">What's on your mind?</h2>
          <p className="lead">Describe it in a line. We'll find the passages that speak to it.</p>
        </div>
        <div className="ask-box" data-reveal>
          <div className={`ask-row${busy ? ' busy' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <label htmlFor="ask" className="sr-only">Describe your situation</label>
            <input id="ask" type="text" value={text} autoComplete="off"
              placeholder="e.g. I get nervous when I speak in class" onChange={(e) => setText(e.target.value)} />
            {text && <button type="button" className="clear-btn" onClick={() => setText('')} aria-label="Clear">✕</button>}
          </div>
          <div className="chips">
            {ASK_EXAMPLES.map((ex) => <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>{ex}</button>)}
          </div>
          {res?.error && <p className="notice error">The backend isn't reachable. Start it and try again.</p>}
          <CarePanel care={res?.care} />
          {res?.matches && (
            <div className="match-list" aria-live="polite">
              {res.matches.map((m, i) => <MatchCard key={m.id} m={m} i={i} onUse={useMatch} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: '01', color: '#e0621a', title: 'Pick a verified teaching', text: '40 exact passages from the Complete Works, each linked to its source.',
    icon: <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h6M8 11h6" /> },
  { n: '02', color: '#2f3a8f', title: 'Tell your moment', text: 'An exam, a stage, a phone that won’t stop buzzing. In your words.',
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  { n: '03', color: '#2f7d4a', title: 'Get an honest reel', text: 'Hook, story, his words, one action and subtitles. In English, हिन्दी, বাংলা or தமிழ்.',
    icon: <><rect x="6" y="2" width="12" height="20" rx="2" /><polygon points="10 9 15 12 10 15" /></> },
];

export default function Home({ firstName, backend }) {
  const lib = useLibrary();
  const counts = useMemo(() => Object.fromEntries(THEMES.map((t) => [t.id, lib.forTheme(t.id).length])), [lib.quotes]); // eslint-disable-line react-hooks/exhaustive-deps
  const [check, setCheck] = useState('');

  return (
    <div className="home">
      <section className="hero" data-nav-dark>
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow light">{greeting()}, {firstName}</span>
            <h1 className="hero-title">His real words.<br /><em>Your real life.</em></h1>
            <p className="hero-sub">Turn a verified teaching of Swami Vivekananda into an honest 30–60 second reel, with the source on screen.</p>
            <div className="hero-actions">
              <a href="#/reels/new" className="btn btn-primary btn-lg">Make a reel</a>
              <a href="#start" className="btn btn-ghost-light btn-lg"
                onClick={(e) => { e.preventDefault(); document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Try it in one line
              </a>
            </div>
            <ul className="hero-facts">
              <li><b>40</b> verified passages</li>
              <li><b>4</b> languages</li>
              <li><b>0</b> invented quotes</li>
            </ul>
          </div>
          <div className="hero-stage">
            <span className="hero-glyph" aria-hidden="true">एकाग्र</span>
            <Hero3D size={0.95} offset={[0, 0.22]} />
            <GuideHero backend={backend} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head" data-reveal>
            <span className="eyebrow">How it works</span>
            <h2 className="h2">Three steps. One minute.</h2>
          </div>
          <div className="steps-grid">
            {STEPS.map((s, i) => (
              <article key={s.n} className="step-card fx-card" data-spot data-reveal style={{ '--d': `${i * 0.1}s`, '--accent': s.color }}>
                <span className="step-n" aria-hidden="true">{s.n}</span>
                <span className="step-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.icon}</svg>
                </span>
                <span className="step-label">Step {i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                {i < STEPS.length - 1 && <span className="step-link" aria-hidden="true">→</span>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <Anatomy />

      <Ask backend={backend} />

      <section className="section section-tint">
        <div className="container">
          <div className="section-head row" data-reveal>
            <div>
              <span className="eyebrow">Themes</span>
              <h2 className="h2">Start from what you need.</h2>
            </div>
            <a href="#/teachings" className="link-arrow">All teachings →</a>
          </div>
          <ThemeGrid counts={counts} />
        </div>
      </section>

      <section className="band" data-nav-dark>
        <div className="container band-inner" data-reveal>
          <div>
            <h2 className="h2">Seen a “Vivekananda quote” on WhatsApp?</h2>
            <p>Many aren't his. Check one against the verified passages.</p>
          </div>
          <form className="band-form" onSubmit={(e) => { e.preventDefault(); try { sessionStorage.setItem('ekagra-factcheck', check); } catch { /* blocked */ } go('factcheck'); }}>
            <input value={check} onChange={(e) => setCheck(e.target.value)} placeholder="Paste the quote…" aria-label="Quote to check" />
            <button type="submit" className="btn btn-primary">Check</button>
          </form>
        </div>
      </section>

      <footer className="footer" data-nav-dark>
        <div className="container footer-inner">
          <span className="brand"><span className="brand-name">EKAGRA</span><span className="brand-hindi" lang="hi">एकाग्र</span></span>
          <span>Every quotation from <i>The Complete Works of Swami Vivekananda</i>, shown with its volume and lecture.</span>
        </div>
      </footer>
    </div>
  );
}
