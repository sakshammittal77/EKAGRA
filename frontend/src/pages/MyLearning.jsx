import { THEMES, TEACHINGS, themeById } from '../data/teachings.js';
import { QuoteCard, TrackCard } from '../components/Cards.jsx';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyLearning({ progress }) {
  const learned = TEACHINGS.filter((t) => progress.learned.includes(t.id));
  const areasStarted = THEMES.filter((th) => learned.some((t) => t.themeId === th.id)).length;

  return (
    <div className="page">
      <section className="hello">
        <div>
          <span className="eyebrow">My learning</span>
          <h1 className="page-title">Your journey so far.</h1>
          <p className="lead">Every teaching you mark as learned shows up here.</p>
        </div>
      </section>

      <section className="stats">
        <div className="stat"><span className="stat-num">{learned.length}</span><span className="stat-label">teachings learned</span></div>
        <div className="stat"><span className="stat-num">{areasStarted}</span><span className="stat-label">areas growing</span></div>
        <div className="stat"><span className="stat-num">{progress.checkins.length}</span><span className="stat-label">check-ins taken</span></div>
      </section>

      <section className="block">
        <h2 className="section-title">Progress by area</h2>
        <div className="track-grid">
          {THEMES.map((t) => <TrackCard key={t.id} theme={t} learnedIds={progress.learned} />)}
        </div>
      </section>

      <section className="block">
        <h2 className="section-title">Quotes you've learned</h2>
        {learned.length === 0 ? (
          <div className="empty">
            <h3>Nothing here yet</h3>
            <p className="muted">Open a theme in Teachings and press "Mark as learned" on a quote you've understood.</p>
            <a href="#/teachings" className="btn-secondary btn-link">Go to Teachings</a>
          </div>
        ) : (
          <div className="quote-grid">
            {learned.map((t) => (
              <QuoteCard key={t.id} teaching={t} learned
                label={`Learned in ${themeById(t.themeId).area}`}
                onToggle={() => progress.toggleLearned(t.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="block">
        <h2 className="section-title">Check-in history</h2>
        {progress.checkins.length === 0 ? (
          <div className="empty">
            <p className="muted">You haven't taken a check-in yet.</p>
            <a href="#/quiz" className="btn-secondary btn-link">Take the check-in</a>
          </div>
        ) : (
          <ul className="history">
            {progress.checkins.map((c) => {
              const th = themeById(c.themeId);
              return (
                <li key={c.at}>
                  <span>{formatDate(c.at)}</span>
                  <span className="history-area">{th.area}</span>
                  <a href={`#/teachings/${th.id}`}>{th.name} teachings →</a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
