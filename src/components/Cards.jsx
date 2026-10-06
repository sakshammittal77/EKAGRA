import { THEMES, teachingsForTheme } from '../data/teachings.js';

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ThemeCard({ theme }) {
  return (
    <a href={`#/teachings/${theme.id}`} className="theme-card">
      <span className="theme-name">{theme.name}</span>
      <span className="theme-hi" lang="hi">{theme.hi}</span>
      <span className="theme-blurb">{theme.blurb}</span>
    </a>
  );
}

export function ThemeGrid() {
  return (
    <div className="theme-grid">
      {THEMES.map((t) => <ThemeCard key={t.id} theme={t} />)}
    </div>
  );
}

// His words: always in the locked saffron block with a source badge.
export function QuoteCard({ teaching, learned, onToggle, label }) {
  return (
    <figure className="quote-card">
      <div className="quote-top">
        <span className="quote-label"><LockIcon /> His words</span>
        {label && <span className="quote-meta">{label}</span>}
      </div>
      <blockquote className={`quote-text${teaching.isPlaceholder ? ' placeholder' : ''}`}>
        {teaching.text}
      </blockquote>
      <div className="quote-bottom">
        <figcaption className="source-badge"><TickIcon /> {teaching.source}</figcaption>
        {onToggle && (
          <button
            type="button"
            className={`learn-btn${learned ? ' done' : ''}`}
            aria-pressed={learned}
            onClick={onToggle}
          >
            {learned ? '✓ Learned' : 'Mark as learned'}
          </button>
        )}
      </div>
    </figure>
  );
}

export function TrackCard({ theme, learnedIds }) {
  const items = teachingsForTheme(theme.id);
  const done = items.filter((t) => learnedIds.includes(t.id)).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <article className="track-card">
      <div className="track-head">
        <h3 className="track-name">{theme.area}</h3>
        <span className="track-count">{done} / {items.length}</span>
      </div>
      <span className="track-theme">{theme.name} · <span lang="hi">{theme.hi}</span></span>
      <div className="track-bar" role="progressbar" aria-label={`${theme.area} progress`}
        aria-valuenow={done} aria-valuemin={0} aria-valuemax={items.length}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <a href={`#/teachings/${theme.id}`} className="track-link">
        {done === items.length ? 'Review teachings →' : done === 0 ? 'Start learning →' : 'Continue →'}
      </a>
    </article>
  );
}
