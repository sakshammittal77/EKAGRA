import { useEffect, useRef, useState } from 'react';
import { THEMES, themeById } from '../data/teachings.js';
import {
  captions, editReel, generateReel, hookVariants, matchQuotes, renderReel, renderStatus,
} from '../lib/api.js';
import { clearReelDraft, peekReelDraft, useLibrary } from '../lib/library.js';
import { ThemeGrid } from '../components/Cards.jsx';
import ReelPlayer from '../components/ReelPlayer.jsx';
import { CarePanel, MatchCard } from './Home.jsx';

// Reel studio: 1) theme  2) situation (+ live passage match)  3) watch, edit, export.
// The backend picks an exact passage (the AI may only choose its ID), writes the script
// around it, and every edit is checked so nobody can put new words in his mouth.

export const LANGUAGES = [
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
const PIPELINE = [
  'parsing your situation',
  'scanning 40 verified passages',
  'locking the passage verbatim',
  'writing hook, scene and action',
  'timing 5 scenes · building captions',
];

function friendlyError(err) {
  const msg = String(err?.message || err);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return "The reel maker isn't running right now. Start the backend, then try again.";
  }
  if (msg.startsWith('401')) return 'Your login has expired. Please log out and log in again.';
  if (msg.startsWith('403')) return 'Please verify your email first, then log out and log in again.';
  return msg.replace(/^\d+:\s*/, '');
}

function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function Pipeline({ done }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((k) => Math.min(PIPELINE.length - 1, k + 1)), 650);
    return () => clearInterval(id);
  }, []);
  const shown = done ? PIPELINE.length : n + 1;
  return (
    <div className="pipeline" role="status">
      <div className="pipeline-scan" />
      {PIPELINE.slice(0, shown).map((line, i) => (
        <div key={line} className="pipe-line mono">
          <span>&gt; {line}</span>
          <b className={i < shown - 1 || done ? 'ok' : 'run'}>{i < shown - 1 || done ? 'DONE' : '···'}</b>
        </div>
      ))}
    </div>
  );
}

function SceneEditor({ reel, onSaved }) {
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [hooks, setHooks] = useState(null);
  const dirty = Object.keys(drafts).length > 0;

  function set(num, field, value) {
    setDrafts((d) => ({ ...d, [num]: { ...(d[num] || {}), [field]: value } }));
  }

  async function save(extra) {
    const scenes = Object.entries({ ...drafts, ...(extra || {}) }).map(([num, f]) => ({ scene_number: Number(num), ...f }));
    if (!scenes.length) return;
    setSaving(true); setMsg(null);
    try {
      const res = await editReel(reel._id, scenes);
      setDrafts({});
      onSaved(res.reel);
      setMsg({ kind: 'ok', text: 'Saved. Captions were rebuilt.' });
    } catch (err) {
      setMsg({ kind: 'error', text: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  }

  async function loadHooks() {
    setHooks('loading');
    try { setHooks((await hookVariants(reel._id)).hooks); } catch (err) { setHooks(null); setMsg({ kind: 'error', text: friendlyError(err) }); }
  }

  return (
    <div className="editor">
      <div className="editor-hooks">
        <button type="button" className="btn btn-sm btn-soft" onClick={loadHooks} disabled={hooks === 'loading'}>
          {hooks === 'loading' ? 'Thinking…' : '⟳ Try other hooks'}
        </button>
        {Array.isArray(hooks) && hooks.map((h) => (
          <button key={h} type="button" className="hook-chip" onClick={() => { setHooks(null); save({ 1: { voiceover_text: h } }); }}>{h}</button>
        ))}
      </div>
      <ol className="scene-list">
        {(reel.scenes || []).map((s) => {
          const locked = !!s.authentic_quote;
          const d = drafts[s.scene_number] || {};
          return (
            <li key={s.scene_number} className={`scene fx-card${locked ? ' locked' : ''}`} data-spot style={{ '--d': `${(s.scene_number - 1) * 0.06}s` }}>
              <div className="scene-head">
                <span className="scene-name mono">{String(s.scene_number).padStart(2, '0')} · {s.name}</span>
                <span className="mono small muted">{s.time_label}</span>
              </div>
              {locked ? (
                <>
                  <p className="scene-quote">“{s.authentic_quote}”</p>
                  <span className="ai-label lock">🔒 His exact words · can't be edited</span>
                </>
              ) : (
                <>
                  <input className="scene-input onscreen" value={d.on_screen_text ?? s.on_screen_text ?? ''} maxLength={120}
                    onChange={(e) => set(s.scene_number, 'on_screen_text', e.target.value)} aria-label={`${s.name} on-screen text`} />
                  <textarea className="scene-input" rows={2} value={d.voiceover_text ?? s.voiceover_text ?? ''} maxLength={600}
                    onChange={(e) => set(s.scene_number, 'voiceover_text', e.target.value)} aria-label={`${s.name} narration`} />
                  <p className="muted small scene-visual">🎬 {s.visual_description}</p>
                  <span className="ai-label">AI-written · editable</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {msg && <p className={`notice ${msg.kind}`}>{msg.text}</p>}
      <div className="editor-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={() => save()}>
          {saving ? 'Saving…' : dirty ? 'Save edits' : 'No changes'}
        </button>
        {dirty && <button type="button" className="btn btn-ghost" onClick={() => setDrafts({})}>Discard</button>}
      </div>
    </div>
  );
}

function SharePanel({ reel, onRemix, busy }) {
  const [copied, setCopied] = useState('');
  const [cloud, setCloud] = useState(null);
  const hook = reel.scenes?.[0]?.voiceover_text || '';
  const caption = `${hook}\n\n“${reel.authenticQuote}”\n— Swami Vivekananda\n📖 ${reel.sourceCitation}\n\nTry this: ${reel.takeawayAction}\n\nWords verified from the Complete Works · made with EKAGRA\n#SwamiVivekananda #NationalYouthDay #Motivation #StudentLife #EKAGRA`;

  function copy(text, what) {
    navigator.clipboard?.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(''), 1500);
  }

  async function grab(fmt) {
    try { download(`ekagra-${reel._id}.${fmt}`, await captions(reel._id, fmt)); } catch { download(`ekagra-${reel._id}.srt`, reel.srtSubtitles || ''); }
  }

  async function cloudRender() {
    setCloud({ state: 'start' });
    try {
      let res = await renderReel(reel._id);
      if (res.status === 'not_configured') { setCloud({ state: 'off' }); return; }
      const t0 = Date.now();
      while (!['succeeded', 'failed'].includes(res.status) && Date.now() - t0 < 240000) {
        await new Promise((r) => setTimeout(r, 5000));
        setCloud({ state: 'wait', s: Math.round((Date.now() - t0) / 1000) });
        res = await renderStatus(reel._id);
      }
      setCloud(res.status === 'succeeded' ? { state: 'done', url: res.video_url } : { state: 'fail' });
    } catch { setCloud({ state: 'fail' }); }
  }

  return (
    <div className="share">
      <div className="share-block fx-card" data-spot>
        <span className="eyebrow">Post caption</span>
        <pre className="caption-box">{caption}</pre>
        <button type="button" className="btn btn-sm btn-dark" onClick={() => copy(caption, 'cap')}>{copied === 'cap' ? '✓ Copied' : 'Copy caption'}</button>
      </div>
      <div className="share-block fx-card" data-spot>
        <span className="eyebrow">Subtitles</span>
        <div className="row-btns">
          <button type="button" className="btn btn-sm btn-soft" onClick={() => grab('srt')}>↓ .srt</button>
          <button type="button" className="btn btn-sm btn-soft" onClick={() => grab('vtt')}>↓ .vtt</button>
          <button type="button" className="btn btn-sm btn-soft" onClick={() => download(`ekagra-${reel._id}-script.txt`, reel.fullVoiceover || '')}>↓ narration .txt</button>
        </div>
      </div>
      <div className="share-block fx-card" data-spot>
        <span className="eyebrow">Remake in another language</span>
        <p className="muted small">Same passage. His words stay in the original English.</p>
        <div className="row-btns">
          {LANGUAGES.filter((l) => l.code !== reel.language).map((l) => (
            <button key={l.code} type="button" className="btn btn-sm btn-soft" lang={l.code} disabled={busy} onClick={() => onRemix(l.code)}>{l.label}</button>
          ))}
        </div>
      </div>
      <div className="share-block fx-card" data-spot>
        <span className="eyebrow">Cloud MP4 (optional)</span>
        <p className="muted small">Needs a Creatomate key on the backend. The .webm export works without it.</p>
        {!cloud && <button type="button" className="btn btn-sm btn-soft" onClick={cloudRender}>Render MP4</button>}
        {cloud?.state === 'start' && <p className="mono small">Starting…</p>}
        {cloud?.state === 'wait' && <p className="mono small">Rendering… {cloud.s}s</p>}
        {cloud?.state === 'off' && <p className="muted small">No CREATOMATE_API_KEY on the backend, so cloud video is off.</p>}
        {cloud?.state === 'fail' && <p className="notice error">The cloud render didn't finish. Try the .webm export.</p>}
        {cloud?.state === 'done' && <a href={cloud.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-dark">Open MP4 ↗</a>}
      </div>
    </div>
  );
}

export default function NewReel({ backend }) {
  const [draft] = useState(peekReelDraft);
  useEffect(() => { clearReelDraft(); }, []);
  const lib = useLibrary();
  const [themeId, setThemeId] = useState(draft?.theme || null);
  const [situation, setSituation] = useState(draft?.situation || '');
  const [pinned, setPinned] = useState(draft?.teachingId || null);
  const [language, setLanguage] = useState('en');
  const [duration, setDuration] = useState(45);
  const [matches, setMatches] = useState(null);
  const [reel, setReel] = useState(null);
  const [care, setCare] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pipeDone, setPipeDone] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('script');

  const theme = themeId && themeById(themeId);
  const step = !theme ? 1 : !reel ? 2 : 3;
  const offline = backend?.status === 'offline';
  const pinnedQuote = pinned && lib.byId(pinned);

  // live passage preview while typing
  useEffect(() => {
    if (step !== 2) return undefined;
    const q = (situation.trim() || EXAMPLES[themeId] || '').trim();
    const id = setTimeout(() => {
      matchQuotes(q, themeId, 3).then((r) => { setMatches(r.matches); setCare(r.care); }).catch(() => setMatches(null));
    }, 400);
    return () => clearTimeout(id);
  }, [situation, themeId, step]);

  async function make(lang = language, teachingId = pinned) {
    setBusy(true); setPipeDone(false); setError('');
    let uid = backend?.backendUser?.id;
    if (!uid) uid = (await backend?.reconnect?.())?.id;
    if (!uid) { setError(friendlyError(backend?.error || 'Failed to fetch')); setBusy(false); return; }
    const started = Date.now();
    try {
      const res = await generateReel(uid, {
        situation: situation.trim() || EXAMPLES[themeId], theme: themeId, teachingId, language: lang, durationSec: duration,
      });
      await new Promise((r) => setTimeout(r, Math.max(0, 2600 - (Date.now() - started)))); // let the pipeline read
      setPipeDone(true);
      await new Promise((r) => setTimeout(r, 450));
      setReel(res.reel);
      setCare(res.care);
      setLanguage(lang);
      setTab('script');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setThemeId(null); setReel(null); setSituation(''); setPinned(null); setError(''); setMatches(null);
  }

  return (
    <div className="page studio">
      <section className="hello studio-head">
        <div>
          <span className="eyebrow">Reel studio</span>
          <h1 className="page-title">
            {step === 1 ? 'What is it about?' : step === 2 ? `${theme.name}: your moment` : 'Your reel'}
          </h1>
        </div>
      </section>

      <ol className="steps-bar" aria-label="Progress">
        {['Theme', 'Situation', 'Reel'].map((label, i) => (
          <li key={label} className={i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''}>
            <span className="steps-num">{i + 1 < step ? '✓' : i + 1}</span>{label}
          </li>
        ))}
      </ol>

      {backend?.status === 'connecting' && step < 3 && <p className="notice ok" role="status">Connecting to the reel maker…</p>}
      {offline && step < 3 && (
        <p className="notice error" role="status">
          The reel maker isn't reachable.{' '}
          <button type="button" className="link-btn" onClick={() => backend.reconnect()}>Try again</button>
          {backend?.error && <span className="small" style={{ display: 'block', opacity: 0.8 }}>Details: {backend.error}</span>}
        </p>
      )}

      {step === 1 && <ThemeGrid onPick={setThemeId} />}

      {step === 2 && (
        <div className="studio-2">
          <section className="reel-form" data-reveal>
            <div className="field">
              <label htmlFor="situation">Describe a real moment <span className="muted">(optional)</span></label>
              <textarea id="situation" className="input textarea" rows={4} value={situation}
                placeholder={EXAMPLES[themeId]} onChange={(e) => setSituation(e.target.value)} />
            </div>
            <div className="form-row">
              <fieldset className="field">
                <legend>Language</legend>
                <div className="seg">
                  {LANGUAGES.map((l) => (
                    <button key={l.code} type="button" lang={l.code} aria-pressed={language === l.code}
                      className={language === l.code ? 'on' : ''} onClick={() => setLanguage(l.code)}>{l.label}</button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="field">
                <legend>Length</legend>
                <div className="seg">
                  {DURATIONS.map((d) => (
                    <button key={d} type="button" aria-pressed={duration === d} className={duration === d ? 'on' : ''}
                      onClick={() => setDuration(d)}>{d}s</button>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="pin-row">
              {pinnedQuote
                ? <>Passage: <b>{pinnedQuote.theme}</b> <button type="button" className="link-btn" onClick={() => setPinned(null)}>Let AI choose</button></>
                : <>Passage: <b>best match</b> <span className="muted">· or pick one on the right</span></>}
            </div>
            <CarePanel care={care} />
            {error && <p className="notice error" role="alert">{error}</p>}
            {busy ? <Pipeline done={pipeDone} /> : (
              <div className="quiz-actions">
                <button type="button" className="btn btn-soft" onClick={() => setThemeId(null)}>← Theme</button>
                <button type="button" className="btn btn-primary" onClick={() => make()}>Make my reel</button>
              </div>
            )}
          </section>

          <aside className="live-match" data-reveal style={{ '--d': '0.1s' }}>
            <span className="eyebrow">Matching passages</span>
            {!matches && <p className="muted small">Type your moment to see which passages fit.</p>}
            {matches?.map((m, i) => (
              <MatchCard key={m.id} m={m} i={i} active={pinned === m.id} onUse={(q) => setPinned(pinned === q.id ? null : q.id)} />
            ))}
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="studio-3">
          <div className="studio-player" data-reveal>
            <ReelPlayer reel={reel} />
          </div>
          <div className="studio-side" data-reveal style={{ '--d': '0.1s' }}>
            <CarePanel care={care} />
            <div className="verified-strip">
              <span className="tag tag-ok">✓ Verbatim</span>
              <a href={reel.sourceUrl} target="_blank" rel="noreferrer">{reel.sourceCitation} ↗</a>
            </div>
            <div className="tabs-inline" role="tablist">
              {[['script', 'Script'], ['share', 'Share & export']].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            {tab === 'script'
              ? <SceneEditor reel={reel} onSaved={setReel} />
              : <SharePanel reel={reel} busy={busy} onRemix={(lang) => make(lang, reel.teachingId)} />}
            {busy && <Pipeline done={pipeDone} />}
            {error && <p className="notice error">{error}</p>}
            <div className="quiz-actions">
              <button type="button" className="btn btn-soft" onClick={startOver}>Make another</button>
              <a href="#/reels" className="link-arrow">All my reels →</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
