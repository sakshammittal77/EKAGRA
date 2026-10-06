import { THEMES, themeById } from '../data/teachings.js';
import { ThemeGrid, TrackCard } from '../components/Cards.jsx';
import Assistant from '../components/Assistant.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home({ firstName, progress, backend }) {
  const lastCheckin = progress.checkins[0];
  const lastTheme = lastCheckin && themeById(lastCheckin.themeId);

  return (
    <div className="page">
      <section className="hello">
        <div>
          <span className="eyebrow">Namaste</span>
          <h1 className="page-title">{greeting()}, {firstName}.</h1>
          <p className="lead">What would you like to learn today?</p>
        </div>
        <div className="hello-actions">
          <a href="#/quiz" className="btn-secondary btn-link">Take today's check-in</a>
          <a href="#/reels/new" className="btn-primary btn-link">+ Start a new reel</a>
        </div>
      </section>

      <section className="ask">
        <div className="ask-copy">
          <span className="eyebrow light">Ask EKAGRA</span>
          <h2 className="ask-title">How are you feeling?</h2>
          <p>Tell EKAGRA what's on your mind. You'll get a kind reply, Swami Vivekananda's exact words that fit, and one small thing to try today.</p>
        </div>
        <Assistant backend={backend} />
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
