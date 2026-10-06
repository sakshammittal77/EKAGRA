import { useState } from 'react';
import { THEMES, themeById } from '../data/teachings.js';
import { generateReel, renderReel } from '../lib/api.js';

// New reel: 1) theme  2) your situation  3) script, then video.
// The backend picks a verified teaching for the theme, writes the script (LLM)
// and renders the 9:16 video (Creatomate).

// Our themes → the backend's teaching ids (backend/seed_data.py).
const BACKEND_TEACHING_FOR_THEME = {
  courage: 'courage_fear_v1',
  concentration: 'concentration_dhyana_v1',
  'self-confidence': 'strength_life_v1',
  education: 'education_manifestation_v1',
  service: null, // no service teaching on the backend yet: let it choose
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ta', label: 'தமிழ்' },
];

const DURATIONS = [30, 45, 60];

const EXAMPLES = {
  courage: 'I have to give a presentation in class tomorrow and I am scared.',
  concentration: 'I keep checking my phone and cannot finish my studies.',
  'self-confidence': 'I feel everyone in my class is smarter than me.',
  education: 'I only study to pass exams and it feels pointless.',
  service: 'I want to do something meaningful for people around me.',
};

function friendlyError(err) {
  const msg = String(err?.message || err);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return "The reel maker isn't running right now. Ask your backend teammate to start the backend, then try again.";
  }
  if (msg.startsWith('401')) return 'Your login has expired. Please log out and log in again.';
  if (msg.startsWith('403')) return 'Please verify your email first, then log out and log in again.';
  return `Something went wrong while making the reel (${msg}).`;
}

export default function NewReel({ backend }) {
  const [themeId, setThemeId] = useState(null);
  const [situation, setSituation] = useState('');
  const [language, setLanguage] = useState('en');
  const [duration, setDuration] = useState(45);
  const [reel, setReel] = useState(null);
  const [video, setVideo] = useState(null);
  const [busy, setBusy] = useState(''); // '' | 'script' | 'video'
  const [error, setError] = useState('');

  const theme = themeId && themeById(themeId);
  const step = !theme ? 1 : !reel ? 2 : 3;
  const userId = backend?.backendUser?.id;
  const offline = backend?.status === 'offline';

  async function makeScript() {
    setBusy('script'); setError('');
    let uid = userId;
    if (!uid) {
      // Not connected yet (backend asleep?): try again now.
      const u = await backend?.reconnect?.();
      uid = u?.id;
    }
    if (!uid) {
      setError(friendlyError(backend?.error || 'Failed to fetch'));
      setBusy('');
      return;
    }
    try {
      const res = await generateReel(uid, {
        situation: situation.trim() || EXAMPLES[themeId],
        teachingId: BACKEND_TEACHING_FOR_THEME[themeId],
        language,
        durationSec: duration,
      });
      setReel(res.reel);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy('');
    }
  }

  async function makeVideo() {
    setBusy('video'); setError('');
    try {
      setVideo(await renderReel(reel._id));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy('');
    }
  }

  function startOver() {
    setThemeId(null); setReel(null); setVideo(null); setSituation(''); setError('');
  }

  return (
    <div className="page">
      <a href="#/reels" className="back-link">← My reels</a>
      <section className="hello">
        <div>
          <span className="eyebrow">New reel · Step {step} of 3</span>
          <h1 className="page-title">
            {step === 1 && 'Pick a theme.'}
            {step === 2 && 'Tell us your situation.'}
            {step === 3 && 'Your reel.'}
          </h1>
          <p className="lead">
            {step === 1 && 'What should your reel be about?'}
            {step === 2 && `Describe a real moment from your life. We'll match it with a verified teaching on ${theme.name.toLowerCase()}.`}
            {step === 3 && 'Here is your script. When it looks right, make the video.'}
          </p>
        </div>
      </section>

      <ol className="steps-bar" aria-label="Progress">
        {['Theme', 'Situation', 'Reel'].map((label, i) => (
          <li key={label} className={i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''}>
            <span className="steps-num">{i + 1}</span>{label}
          </li>
        ))}
      </ol>

      {backend?.status === 'connecting' && step < 3 && (
        <p className="notice ok" role="status">Waking up the reel maker… this can take up to a minute the first time.</p>
      )}
      {offline && step < 3 && (
        <p className="notice error" role="status">
          The reel maker isn't reachable right now.{' '}
          <button type="button" className="link-btn" style={{ fontSize: 'inherit', color: 'inherit', fontWeight: 600 }}
            onClick={() => backend.reconnect()}>Try again</button>
          {backend?.error && <span className="small" style={{ display: 'block', opacity: 0.8 }}>Details: {backend.error}</span>}
        </p>
      )}

      {step === 1 && (
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button key={t.id} type="button" className="theme-card as-button" onClick={() => setThemeId(t.id)}>
              <span className="theme-name">{t.name}</span>
              <span className="theme-hi" lang="hi">{t.hi}</span>
              <span className="theme-blurb">{t.blurb}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <section className="reel-form">
          <div className="field">
            <label htmlFor="situation">Your situation <span className="muted small">(optional)</span></label>
            <textarea id="situation" className="input textarea" rows={4} value={situation}
              placeholder={EXAMPLES[themeId]} onChange={(e) => setSituation(e.target.value)} />
          </div>

          <div className="form-row">
            <fieldset className="field">
              <legend>Language</legend>
              <div className="chips light">
                {LANGUAGES.map((l) => (
                  <button key={l.code} type="button" lang={l.code} aria-pressed={language === l.code}
                    className={`chip-light${language === l.code ? ' on' : ''}`} onClick={() => setLanguage(l.code)}>
                    {l.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend>Length</legend>
              <div className="chips light">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" aria-pressed={duration === d}
                    className={`chip-light${duration === d ? ' on' : ''}`} onClick={() => setDuration(d)}>
                    {d} sec
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {error && <p className="notice error" role="alert">{error}</p>}

          <div className="quiz-actions">
            <button type="button" className="btn-secondary" onClick={() => setThemeId(null)}>← Change theme</button>
            <button type="button" className="btn-primary" onClick={makeScript} disabled={busy === 'script'}>
              {busy === 'script' ? 'Writing your script…' : 'Make my reel'}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="reel-result">
          <div className="review-row">
            <span className="muted">Teaching</span>
            <strong>{reel.teachingTitle || theme.name}</strong>
          </div>

          <figure className="quote-card">
            <span className="quote-label">His words</span>
            <blockquote className="quote-text">{reel.authenticQuote}</blockquote>
            <figcaption className="source-badge">{reel.sourceCitation}</figcaption>
          </figure>

          <ol className="scene-list">
            {(reel.scenes || []).map((s) => (
              <li key={s.scene_number} className="scene">
                <div className="scene-head">
                  <span className="scene-name">{s.scene_number}. {s.name}</span>
                  <span className="muted small">{s.time_label}</span>
                </div>
                {s.on_screen_text && <p className="scene-onscreen">On screen: “{s.on_screen_text}”</p>}
                <p className="scene-voice">{s.voiceover_text}</p>
                {s.visual_description && <p className="muted small">Visual: {s.visual_description}</p>}
                <span className="ai-label">{s.authentic_quote ? 'Includes his exact words' : 'AI-written'}</span>
              </li>
            ))}
          </ol>

          {reel.takeawayAction && (
            <div className="takeaway">
              <span className="eyebrow">Try this</span>
              <p>{reel.takeawayAction}</p>
            </div>
          )}

          {video?.video_url && (
            <div className="video-box">
              <video src={video.video_url} controls playsInline className="reel-video" />
              {video.mode === 'simulation' && (
                <p className="muted small">This is a sample video. The real one appears once the video service key is added on the backend.</p>
              )}
              <a href={video.video_url} target="_blank" rel="noreferrer">Open video in a new tab</a>
            </div>
          )}

          {error && <p className="notice error" role="alert">{error}</p>}

          <div className="quiz-actions">
            <button type="button" className="btn-secondary" onClick={startOver}>Make another</button>
            {!video && (
              <button type="button" className="btn-primary" onClick={makeVideo} disabled={busy === 'video'}>
                {busy === 'video' ? 'Making the video…' : 'Make the video'}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
