import { useEffect, useRef, useState } from 'react';
import { THEMES } from '../data/teachings.js';
import { setReelDraft } from '../lib/library.js';
import { go } from '../lib/router.js';

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// Each theme's accent colour and line icon.
const THEME_LOOK = {
  courage: { color: '#e0621a', icon: <path d="M12 2c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.6 2.3-4.6.3 1.7 1.2 2.6 2.2 2.6 0-3 .5-5.5.5-8z" /> },
  'self-confidence': { color: '#b8861f', icon: <><path d="M3 20l6-10 4 6 2.5-3.5L21 20z" /><circle cx="17" cy="6" r="2.2" /></> },
  concentration: { color: '#2f3a8f', icon: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></> },
  education: { color: '#1f7a8c', icon: <><path d="M2 6.5C4.5 5 8 5 12 7c4-2 7.5-2 10-.5V19c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5z" /><path d="M12 7v12.5" /></> },
  service: { color: '#2f7d4a', icon: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" /> },
};

// The theme's Hindi word as a large faded backdrop, scaled to exactly fit the card's width
// (measured, so long words like आत्मविश्वास are never cut off).
function FitGlyph({ text }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      const box = el.parentElement.clientWidth;
      if (!box) return;
      el.style.fontSize = '100px';
      const w = el.scrollWidth || 1;
      el.style.fontSize = `${Math.min(76, Math.floor((box / w) * 100 * 0.96))}px`;
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [text]);
  return <span className="theme-glyph-box" aria-hidden="true"><span ref={ref} className="theme-glyph" lang="hi">{text}</span></span>;
}

export function ThemeCard({ theme, count, onClick }) {
  const Tag = onClick ? 'button' : 'a';
  const look = THEME_LOOK[theme.id] || THEME_LOOK.courage;
  return (
    <Tag {...(onClick ? { type: 'button', onClick } : { href: `#/teachings/${theme.id}` })}
      className="theme-card fx-card" data-spot style={{ '--accent': look.color }}>
      <span className="theme-glow" aria-hidden="true" />
      <span className="theme-top">
        <span className="theme-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{look.icon}</svg>
        </span>
        {count != null && <span className="theme-count">{count} passages</span>}
      </span>
      <span className="theme-name">{theme.name}</span>
      <span className="theme-blurb">{theme.blurb}</span>
      <FitGlyph text={theme.hi} />
      <span className="theme-foot">
        <span>{onClick ? 'Choose' : 'Explore'}</span>
        <span className="theme-arrow" aria-hidden="true">→</span>
      </span>
    </Tag>
  );
}

export function ThemeGrid({ counts = {}, onPick }) {
  return (
    <div className="theme-grid">
      {THEMES.map((t, i) => (
        <div key={t.id} className="theme-cell" data-reveal style={{ '--d': `${i * 0.07}s` }}>
          <ThemeCard theme={t} count={counts[t.id]} onClick={onPick ? () => onPick(t.id) : undefined} />
        </div>
      ))}
    </div>
  );
}

const LONG = 230; // characters before a passage is folded behind "Read more"

// Short "Vol. 3 · Lectures from Colombo to Almora" line + chapter, from the full citation.
function sourceParts(t) {
  if (t.volume && t.chapter) {
    const section = (t.source || '').replace(/^.*?Vol\. \d+, /, '').replace(`, "${t.chapter}"`, '');
    return { top: `Vol. ${t.volume}${section ? ` · ${section}` : ''}`, chapter: t.chapter };
  }
  return { top: t.source, chapter: '' };
}

// His words: always in the locked block, with the source.
// exitOnToggle: play a short exit animation before onToggle (the card leaves its list).
export function QuoteCard({ teaching, learned, onToggle, label, themeId, index = 0, exitOnToggle = false, note }) {
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const long = (teaching.text || '').length > LONG;
  const src = sourceParts(teaching);

  function copy() {
    navigator.clipboard?.writeText(`"${teaching.text}"\n— Swami Vivekananda, ${teaching.source}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function makeReel() {
    setReelDraft({ teachingId: teaching.id, theme: themeId || teaching.app_themes?.[0], situation: '' });
    go('reels/new');
  }

  return (
    <figure ref={ref} className={`quote-card${learned ? ' is-learned' : ''}${leaving ? ' leaving' : ''}`} data-spot
      data-reveal style={{ '--d': `${(index % 3) * 0.08}s` }}>
      <span className="qc-mark" aria-hidden="true">”</span>
      <div className="quote-top">
        <span className="tag tag-saffron"><LockIcon /> His words</span>
        {(note || label) && <span className="quote-meta">{note || label}</span>}
      </div>
      <blockquote className={`quote-text${teaching.isPlaceholder ? ' placeholder' : ''}${long && !open ? ' folded' : ''}`}>
        {teaching.text}
      </blockquote>
      {long && (
        <button type="button" className="read-more" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Show less' : 'Read the full passage'}
        </button>
      )}
      <figcaption className="qc-source">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>
        <span>
          {teaching.source_url
            ? <a href={teaching.source_url} target="_blank" rel="noreferrer">{src.top}{' '}↗</a>
            : src.top}
          {src.chapter && <small>“{src.chapter}”</small>}
        </span>
      </figcaption>
      <div className="quote-actions">
        {onToggle && (
          <button type="button" className={`qc-learn${learned || leaving ? ' on' : ''}`} aria-pressed={learned} disabled={leaving}
            onClick={() => { if (!exitOnToggle) { onToggle(); return; } setLeaving(true); setTimeout(onToggle, 420); }}>
            <span className="qc-check" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            {learned ? 'Learned' : leaving ? 'Learned!' : 'Mark learned'}
          </button>
        )}
        <button type="button" className={`qc-icon${copied ? ' done' : ''}`} onClick={copy} aria-label="Copy quote with source" title="Copy with source">
          {copied
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
        </button>
        {!teaching.isPlaceholder && (
          <button type="button" className="qc-reel" onClick={makeReel}>
            Make a reel <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </figure>
  );
}

export function TrackCard({ theme, items, learnedIds }) {
  const done = items.filter((t) => learnedIds.includes(t.id)).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <a href={`#/teachings/${theme.id}`} className="track-card fx-card" data-spot data-reveal style={{ '--accent': (THEME_LOOK[theme.id] || THEME_LOOK.courage).color }}>
      <div className="track-head">
        <h3 className="track-name">{theme.area}</h3>
        <span className="track-count">{done}/{items.length}</span>
      </div>
      <span className="track-theme">{theme.name} · <span lang="hi">{theme.hi}</span></span>
      <div className="track-bar" role="progressbar" aria-label={`${theme.area} progress`}
        aria-valuenow={done} aria-valuemin={0} aria-valuemax={items.length}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </a>
  );
}
