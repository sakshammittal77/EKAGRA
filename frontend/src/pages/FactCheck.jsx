import { useEffect, useState } from 'react';
import { factCheck } from '../lib/api.js';
import { setReelDraft } from '../lib/library.js';
import { go } from '../lib/router.js';

// "Did he really say that?" Paste a quote from WhatsApp or Instagram and check it
// against the verified library. Honest about limits: not found ≠ proven fake.

const VERDICTS = {
  verified: { label: 'VERIFIED', color: 'var(--ok)', text: 'Word for word in The Complete Works.' },
  near_exact: { label: 'ALMOST', color: 'var(--warn)', text: 'Very close to a real passage, but some words differ. Share the exact wording below.' },
  paraphrase: { label: 'PARAPHRASE', color: 'var(--warn)', text: "A similar idea in different words. These aren't his words as written. Quote the real passage instead." },
  misattributed: { label: 'MISATTRIBUTED', color: 'var(--bad)', text: 'This is a known misattribution.' },
  not_found: { label: 'NOT FOUND', color: 'var(--ink-2)', text: "Not in EKAGRA's verified library. That alone doesn't prove it's fake, but don't share it as his words until you find it in the Complete Works." },
  too_short: { label: 'TOO SHORT', color: 'var(--ink-2)', text: 'Paste at least one full sentence.' },
};

const EXAMPLES = [
  'Arise, awake, and stop not till the goal is reached.',
  'In a day when you don\'t come across any problems, you can be sure that you are traveling in a wrong path.',
  'Have faith in yourself and be strong, that is all we need.',
  'Be the change you wish to see in the world.',
];

const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

function Diff({ text, against }) {
  const known = new Set(against.split(/\s+/).map(norm));
  return (
    <p className="diff">
      {text.split(/(\s+)/).map((w, i) => (/\s+/.test(w) ? w : (
        <span key={i} className={known.has(norm(w)) ? '' : 'diff-off'}>{w}</span>
      )))}
    </p>
  );
}

export default function FactCheck() {
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // text handed over from the home page "Check" box
  useEffect(() => {
    let v = '';
    try { v = sessionStorage.getItem('ekagra-factcheck') || ''; sessionStorage.removeItem('ekagra-factcheck'); } catch { /* blocked */ }
    if (v.trim()) { setText(v); run(v); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(value = text) {
    if (!value.trim()) return;
    setBusy(true); setErr(''); setRes(null);
    const t0 = Date.now();
    try {
      const r = await factCheck(value.trim());
      await new Promise((ok) => setTimeout(ok, Math.max(0, 1400 - (Date.now() - t0))));
      setRes({ ...r, input: value.trim() });
    } catch {
      setErr('The checker needs the backend. Start it and try again.');
    } finally {
      setBusy(false);
    }
  }

  const v = res && VERDICTS[res.verdict];

  return (
    <div className="page narrow-wide">
      <section className="hello" data-reveal>
        <div>
          <span className="eyebrow">Fact check</span>
          <h1 className="page-title">Did he really say that?</h1>
          <p className="lead">Paste a quote you saw online. We check it against the verified passages.</p>
        </div>
      </section>

      <section className={`scanner${busy ? ' scanning' : ''}`} data-reveal>
        <div className="scanner-box">
          <textarea className="scanner-input" rows={4} value={text} placeholder="Paste a quote you saw online…"
            onChange={(e) => setText(e.target.value)} aria-label="Quote to check"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }} />
          <div className="scan-beam" aria-hidden="true" />
        </div>
        <div className="scanner-actions">
          <div className="chips">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => { setText(ex); run(ex); }}>{ex.length > 42 ? `${ex.slice(0, 40)}…` : ex}</button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => run()} disabled={busy || !text.trim()}>
            {busy ? 'Scanning…' : 'Check quote'}
          </button>
        </div>
      </section>

      {err && <p className="notice error">{err}</p>}

      {res && v && (
        <section className="verdict" style={{ '--c': v.color }}>
          <div className="verdict-head">
            <div className="ring" style={{ '--p': res.similarity || 0 }}>
              <span className="mono">{res.similarity || 0}%</span>
            </div>
            <div>
              <span className="verdict-label">{v.label}</span>
              <p>{v.text}</p>
              {res.reason && <p className="muted small">{res.reason}</p>}
            </div>
          </div>

          {res.match && res.verdict !== 'verified' && (
            <div className="verdict-block">
              <span className="eyebrow">What you pasted · words not in the original are struck</span>
              <Diff text={res.input} against={res.match.excerpt} />
            </div>
          )}
          {res.match && (
            <div className="verdict-block">
              <span className="eyebrow">The verified passage</span>
              <blockquote className="quote-text">“{res.match.passage}”</blockquote>
              <a href={res.match.source_url} target="_blank" rel="noreferrer" className="small">{res.match.source} ↗</a>
              <div className="row-btns">
                <button type="button" className="btn btn-sm btn-dark" onClick={() => { setReelDraft({ teachingId: res.match.id }); go('reels/new'); }}>Make a reel with the real words →</button>
                <button type="button" className="btn btn-sm btn-soft" onClick={() => navigator.clipboard?.writeText(`"${res.match.passage}"\n— Swami Vivekananda, ${res.match.source}`)}>Copy exact quote</button>
              </div>
            </div>
          )}
          <p className="note">
            EKAGRA checks against {res.library_size || 40} passages it has verified word for word. For anything else, see{' '}
            <a href={res.fact_check_url} target="_blank" rel="noreferrer">Belur Math's Fact Check and Clarifications</a>.
          </p>
        </section>
      )}
    </div>
  );
}
