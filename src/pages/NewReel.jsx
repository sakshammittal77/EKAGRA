import { useState } from 'react';
import { THEMES, themeById, teachingsForTheme } from '../data/teachings.js';

// New reel flow: 1) pick a theme  2) pick a quote  3) review.
// The actual video making is being built by the team (backend + Creatomate);
// this page collects the student's choices and is where that call will plug in.

export default function NewReel() {
  const [themeId, setThemeId] = useState(null);
  const [teachingId, setTeachingId] = useState(null);

  const theme = themeId && themeById(themeId);
  const teachings = themeId ? teachingsForTheme(themeId) : [];
  const teaching = teachings.find((t) => t.id === teachingId);
  const step = !theme ? 1 : !teaching ? 2 : 3;

  return (
    <div className="page">
      <a href="#/reels" className="back-link">← My reels</a>
      <section className="hello">
        <div>
          <span className="eyebrow">New reel · Step {step} of 3</span>
          <h1 className="page-title">
            {step === 1 && 'Pick a theme.'}
            {step === 2 && 'Pick a teaching.'}
            {step === 3 && 'Ready to make your reel.'}
          </h1>
          <p className="lead">
            {step === 1 && 'What should your reel be about?'}
            {step === 2 && `Choose the quotation on ${theme.name.toLowerCase()} you want to bring to life.`}
            {step === 3 && 'Check your choice. Your reel will be built around these exact words.'}
          </p>
        </div>
      </section>

      <ol className="steps-bar" aria-label="Progress">
        {['Theme', 'Teaching', 'Review'].map((label, i) => (
          <li key={label} className={i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''}>
            <span className="steps-num">{i + 1}</span>{label}
          </li>
        ))}
      </ol>

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
        <>
          <div className="pick-list">
            {teachings.map((t, i) => (
              <button key={t.id} type="button" className="pick-item" onClick={() => setTeachingId(t.id)}>
                <span className="quote-label">Teaching {i + 1}</span>
                <span className={`pick-text${t.isPlaceholder ? ' placeholder' : ''}`}>{t.text}</span>
                <span className="pick-source">{t.source}</span>
              </button>
            ))}
          </div>
          <div><button type="button" className="btn-secondary" onClick={() => setThemeId(null)}>← Change theme</button></div>
        </>
      )}

      {step === 3 && (
        <section className="review">
          <div className="review-row"><span className="muted">Theme</span><strong>{theme.name} · <span lang="hi">{theme.hi}</span></strong></div>
          <figure className="quote-card">
            <span className="quote-label">His words</span>
            <blockquote className={`quote-text${teaching.isPlaceholder ? ' placeholder' : ''}`}>{teaching.text}</blockquote>
            <figcaption className="source-badge">{teaching.source}</figcaption>
          </figure>
          <div className="quiz-actions">
            <button type="button" className="btn-secondary" onClick={() => setTeachingId(null)}>← Change teaching</button>
            <button type="button" className="btn-primary" disabled title="Coming soon">Make my reel</button>
          </div>
          <p className="care-note">Reel making is coming soon. Your team is connecting the video maker; this button will start it.</p>
        </section>
      )}
    </div>
  );
}
