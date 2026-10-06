import { useState } from 'react';
import { THEMES, themeById } from '../data/teachings.js';
import { ThemeGrid, TrackCard } from '../components/Cards.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const ASK_EXAMPLES = ["I'm scared of exams", "I can't focus", "I don't believe in myself", 'I want to help others'];

export default function Home({ firstName, progress }) {
  const [askText, setAskText] = useState('');
  const [askNote, setAskNote] = useState('');
  const lastCheckin = progress.checkins[0];
  const lastTheme = lastCheckin && themeById(lastCheckin.themeId);

  function handleAsk(e) {
    e.preventDefault();
    // The LLM assistant is being built separately; this is the hook it will plug into.
    setAskNote('The assistant is coming soon. Meanwhile, try the check-in below or pick a theme.');
  }

  return (
    <div className="page">
      <section className="hello">
        <div>
          <span className="eyebrow">Namaste</span>
          <h1 className="page-title">{greeting()}, {firstName}.</h1>
          <p className="lead">What would you like to learn today?</p>
        </div>
        <a href="#/quiz" className="btn-primary btn-link">Take today's check-in</a>
      </section>

      <section className="ask">
        <div className="ask-copy">
          <span className="eyebrow light">Ask EKAGRA</span>
          <h2 className="ask-title">What's on your mind?</h2>
          <p>Tell us what you're struggling with, and we'll point you to a teaching that speaks to it.</p>
        </div>
        <form className="ask-form" onSubmit={handleAsk}>
          <div className="ask-row">
            <label htmlFor="ask" className="sr-only">Describe your problem</label>
            <input id="ask" className="input" type="text" value={askText}
              placeholder="e.g. I get nervous when I speak in class"
              onChange={(e) => setAskText(e.target.value)} />
            <button type="submit" className="ask-send" aria-label="Ask">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </div>
          <div className="chips">
            {ASK_EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => setAskText(ex)}>{ex}</button>
            ))}
          </div>
          {askNote && <p className="ask-note" role="status">{askNote}</p>}
        </form>
      </section>

      <section className="checkin-card">
        <div>
          <span className="eyebrow">Check-in</span>
          <h2 className="section-title">How are you feeling?</h2>
          <p className="muted">
            {lastTheme
              ? `Your last check-in pointed to ${lastTheme.area.toLowerCase()}. Want to see how things are today?`
              : 'Answer 8 quick questions to discover which teachings can help you most right now.'}
          </p>
        </div>
        <a href="#/quiz" className="btn-secondary btn-link">{lastTheme ? 'Check in again' : 'Start the check-in'}</a>
      </section>

      <section className="block">
        <div className="block-head">
          <h2 className="section-title">My learning journey</h2>
          <a href="#/learning">See all</a>
        </div>
        <div className="track-grid">
          {THEMES.slice(0, 3).map((t) => <TrackCard key={t.id} theme={t} learnedIds={progress.learned} />)}
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2 className="section-title">Pick a theme</h2>
          <a href="#/teachings">All teachings</a>
        </div>
        <ThemeGrid />
      </section>

      <p className="note page-note">Quotations shown are placeholders until the team adds verified ones from <i>The Complete Works of Swami Vivekananda</i>.</p>
    </div>
  );
}
