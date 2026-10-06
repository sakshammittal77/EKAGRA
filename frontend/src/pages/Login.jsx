import { useEffect, useRef, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../firebase.js';
import { UI, PANEL, SANSKRIT_WORDS, LIFE_CARDS, LANGUAGES } from '../data/content.js';
import { MESSAGES, friendlyError } from '../data/messages.js';

const CARD_MS = 10000; // how long each life card stays

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Arrow({ dir }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  );
}

export default function Login() {
  const [lang, setLang] = useState('en');
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { kind: 'error' | 'ok', text }

  const [cardIndex, setCardIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [glowOn, setGlowOn] = useState(false);
  const pageRef = useRef(null);

  const t = UI[lang];
  const p = PANEL[lang];
  const m = MESSAGES[lang];
  const card = LIFE_CARDS[cardIndex];
  const loc = card[lang];

  // Life cards move on their own; hovering pauses them.
  useEffect(() => {
    if (paused) return undefined;
    const id = setTimeout(() => setCardIndex((i) => (i + 1) % LIFE_CARDS.length), CARD_MS);
    return () => clearTimeout(id);
  }, [cardIndex, paused]);

  // Mouse-following glow, using CSS variables so React doesn't re-render on every move.
  function handleMouseMove(e) {
    const el = pageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
    if (!glowOn) setGlowOn(true);
  }

  function changeLanguage(code) {
    setLang(code);
    setNotice(null);
    document.documentElement.lang = code;
  }

  function switchMode(next) {
    setMode(next);
    setNotice(null);
    setConfirm('');
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (!isFirebaseConfigured) return setNotice({ kind: 'error', text: m.setup });
    if (!email.trim() || !password) return setNotice({ kind: 'error', text: m.missing });
    if (mode === 'signup') {
      if (password.length < 6) return setNotice({ kind: 'error', text: m.weak });
      if (!confirm) return setNotice({ kind: 'error', text: m.confirmMissing });
      if (password !== confirm) return setNotice({ kind: 'error', text: m.mismatch });
    }
    setBusy(true);
    setNotice(null);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // Send the verification link; App.jsx shows the "verify your email" screen until it's clicked.
        try {
          await sendEmailVerification(cred.user, { url: window.location.origin });
        } catch { /* they can resend from the verify screen */ }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      // On success, App.jsx notices the signed-in user and changes the screen.
    } catch (err) {
      if (mode === 'signup' && err.code === 'auth/email-already-in-use') {
        // Already registered: switch to Log in, keep what they typed, and explain.
        setMode('login');
        setConfirm('');
        setNotice({ kind: 'ok', text: m.existsSwitch });
      } else {
        // On a failed login, offer a one-click switch to sign-up when the account may not exist.
        const mayNotExist = mode === 'login' && ['auth/user-not-found', 'auth/invalid-credential'].includes(err.code);
        setNotice({ kind: 'error', text: friendlyError(err.code, lang), offerSignup: mayNotExist });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (!isFirebaseConfigured) return setNotice({ kind: 'error', text: m.setup });
    setBusy(true);
    setNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setNotice({ kind: 'error', text: friendlyError(err.code, lang) });
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    if (!isFirebaseConfigured) return setNotice({ kind: 'error', text: m.setup });
    if (!email.trim()) return setNotice({ kind: 'error', text: m.resetNeedEmail });
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice({ kind: 'ok', text: m.resetSent });
    } catch (err) {
      setNotice({ kind: 'error', text: friendlyError(err.code, lang) });
    }
  }

  const isSignup = mode === 'signup';

  return (
    <div
      className="login-page"
      ref={pageRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setGlowOn(false)}
    >
      <div className={`glow${glowOn ? ' on' : ''}`} aria-hidden="true" />

      {/* ---------- Left dark panel ---------- */}
      <section className="panel" lang={lang}>
        <div className="panel-top">
          <div className="brand">
            <span className="brand-name" lang="en">EKAGRA</span>
            <span className="brand-hindi" lang="hi">एकाग्र</span>
          </div>
          <span className="eyebrow-light">{p.tag}</span>
        </div>

        <div>
          <div className="hero-line">
            <span className="hero-word">{p.arise}</span>
            <span className="hero-sanskrit" lang="sa">उत्तिष्ठत</span>
          </div>
          <p className="hero-desc">{p.desc}</p>
        </div>

        <ul className="words">
          {p.words.map((word, k) => (
            <li key={word}>
              <span className="main">{word}</span>
              <span className="sa" lang="sa">{SANSKRIT_WORDS[k]}</span>
            </li>
          ))}
        </ul>

        <div
          className={`cards${paused ? ' paused' : ''}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="cards-head">
            <span className="eyebrow-light">
              {p.life} · {cardIndex + 1} / {LIFE_CARDS.length}
            </span>
            <div className="cards-nav">
              <button type="button" className="round-btn" aria-label="Previous card"
                onClick={() => setCardIndex((i) => (i - 1 + LIFE_CARDS.length) % LIFE_CARDS.length)}>
                <Arrow dir="left" />
              </button>
              <button type="button" className="round-btn" aria-label="Next card"
                onClick={() => setCardIndex((i) => (i + 1) % LIFE_CARDS.length)}>
                <Arrow dir="right" />
              </button>
            </div>
          </div>

          <article className="life-card" aria-live="polite">
            {/* key makes the slide-in animation replay for each card */}
            <div className="life-card-body" key={`${cardIndex}-${lang}`}>
              <div className="life-card-title-row">
                <span className="life-card-title">{loc.title}</span>
                <span className="life-card-year">{card.year}</span>
              </div>
              <div className="life-card-meta">
                <span className="sub" lang={lang === 'en' ? 'hi' : 'en'}>
                  {lang === 'en' ? card.hi.title : card.en.title}
                </span>
                <span>·</span>
                <span>{loc.place}</span>
              </div>
              <p className="life-card-text">{loc.text}</p>
            </div>
            <div className="progress">
              <div className="progress-bar" key={cardIndex} style={{ animationDuration: `${CARD_MS}ms` }} />
            </div>
          </article>

          <div className="dots">
            {LIFE_CARDS.map((c, k) => (
              <button
                key={c.en.title}
                type="button"
                className={`dot${k === cardIndex ? ' active' : ''}`}
                aria-label={`Show card ${k + 1}`}
                aria-current={k === cardIndex}
                onClick={() => setCardIndex(k)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Right side ---------- */}
      <main className={`side${isSignup ? ' signup' : ''}`}>
        <div className="lang-bar">
          <span className="lang-label">{t.language}</span>
          {LANGUAGES.map((code) => (
            <button
              key={code}
              type="button"
              lang={code}
              className="lang-btn"
              aria-pressed={code === lang}
              onClick={() => changeLanguage(code)}
            >
              {UI[code].label}
            </button>
          ))}
        </div>

        <form className="auth-card" lang={lang} onSubmit={handleEmailSubmit} noValidate>
          <div>
            <span className="auth-eyebrow">{isSignup ? m.signupEyebrow : t.eyebrow}</span>
            <h1 className="auth-title" style={{ '--hsize': t.hsize }}>
              {isSignup ? m.signupHeading : t.heading}
            </h1>
          </div>

          <div className="fields">
            <div className="field">
              <label htmlFor="email">{t.email}</label>
              <input id="email" className="input" type="email" autoComplete="email"
                placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <div className="field-row">
                <label htmlFor="password">{t.password}</label>
                {!isSignup && (
                  <button type="button" className="link-btn" onClick={handleForgot}>{t.forgot}</button>
                )}
              </div>
              <input id="password" className="input" type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {isSignup && (
              <div className="field">
                <label htmlFor="confirm">{m.confirmLabel}</label>
                <input id="confirm" className="input" type="password" autoComplete="new-password"
                  placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={confirm.length > 0 && confirm !== password}
                  aria-describedby="confirm-hint" />
                {confirm.length > 0 && (
                  <span id="confirm-hint" className={`field-hint ${confirm === password ? 'ok' : 'bad'}`}>
                    {confirm === password ? m.match : m.mismatch}
                  </span>
                )}
              </div>
            )}
          </div>

          {notice && (
            <p className={`notice ${notice.kind}`} role="alert">
              {notice.text}
              {notice.offerSignup && (
                <>
                  {' '}{m.newHere}{' '}
                  <button type="button" className="link-btn" style={{ fontSize: 'inherit', fontWeight: 600 }}
                    onClick={() => switchMode('signup')}>{t.signup}</button>
                </>
              )}
            </p>
          )}

          <div className="actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? m.working : isSignup ? m.signupBtn : t.login}
            </button>
            <button type="button" className="btn-google" onClick={handleGoogle} disabled={busy}>
              <GoogleIcon />
              <span>{t.google}</span>
            </button>
          </div>

          {isSignup ? (
            <p className="muted">
              {m.haveAccount}{' '}
              <button type="button" className="link-btn" style={{ fontSize: 15, fontWeight: 600 }} onClick={() => switchMode('login')}>
                {m.loginLink}
              </button>
            </p>
          ) : (
            <p className="muted">
              {t.first}{' '}
              <button type="button" className="link-btn" style={{ fontSize: 15, fontWeight: 600 }} onClick={() => switchMode('signup')}>
                {t.signup}
              </button>
            </p>
          )}
        </form>

        <div className="how" lang={lang}>
          <span className="how-title">{t.how}</span>
          <ol className="steps">
            <li><span className="step-num">01</span><span className="step-text">{t.s1}</span></li>
            <li><span className="step-num">02</span><span className="step-text">{t.s2}</span></li>
            <li><span className="step-num">03</span><span className="step-text">{t.s3}</span></li>
          </ol>
          <p className="note">{t.note}</p>
        </div>
      </main>
    </div>
  );
}
