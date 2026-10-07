import { useEffect, useState } from 'react';
import { THEMES, themeById } from '../data/teachings.js';
import { TrackCard } from '../components/Cards.jsx';
import { useLibrary } from '../lib/library.js';
import { getStats } from '../lib/api.js';
import { CountUp } from '../fx/bits.jsx';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyLearning({ progress, backend }) {
  const lib = useLibrary();
  const [stats, setStats] = useState(null);
  const uid = backend?.backendUser?.id;
  useEffect(() => { if (uid) getStats(uid).then(setStats).catch(() => {}); }, [uid]);

  const learned = lib.quotes.filter((t) => progress.learned.includes(t.id));
  const week = stats?.last7 || [];
  const max = Math.max(1, ...week.map((d) => d.count));

  const tiles = [
    ['Reels made', stats?.reels || 0],
    ['Day streak', stats?.streak || 0],
    ['Passages used', stats?.passages || 0, `/${stats?.library_size || 40}`],
    ['Passages learned', learned.length, `/${lib.quotes.length || 40}`],
  ];

  return (
    <div className="page">
      <section className="hello" data-reveal>
        <div>
          <span className="eyebrow">Progress</span>
          <h1 className="page-title">Your journey so far.</h1>
        </div>
      </section>

      <section className="stats-row">
        {tiles.map(([k, v, suffix], i) => (
          <div key={k} className="stat-tile fx-card" data-spot data-reveal style={{ '--d': `${i * 0.06}s` }}>
            <span className="stat-v"><CountUp value={v} />{suffix && <small>{suffix}</small>}</span>
            <span className="stat-k">{k}</span>
          </div>
        ))}
        <div className="stat-tile chart fx-card" data-spot data-reveal style={{ '--d': '0.24s' }}>
          <div className="bars">
            {(week.length ? week : Array.from({ length: 7 }, (_, i) => ({ date: String(i), count: 0 }))).map((d) => (
              <div key={d.date} className="bar" title={`${d.date}: ${d.count} reels`}>
                <i style={{ height: `${(d.count / max) * 100}%` }} />
                <span>{d.date.length > 2 ? new Date(d.date).toLocaleDateString('en', { weekday: 'narrow' }) : ''}</span>
              </div>
            ))}
          </div>
          <span className="stat-k">Reels, last 7 days</span>
        </div>
      </section>

      <section className="block">
        <h2 className="h3" data-reveal>By area</h2>
        <div className="track-grid">
          {THEMES.map((t) => <TrackCard key={t.id} theme={t} items={lib.forTheme(t.id)} learnedIds={progress.learned} />)}
        </div>
      </section>

      <section className="block">
        <div className="row-between" data-reveal>
          <h2 className="h3">Passages you've learned</h2>
          <a href="#/history" className="btn btn-dark btn-sm">Open History · {learned.length}</a>
        </div>
      </section>

      <section className="block">
        <div className="row-between" data-reveal>
          <h2 className="h3">Check-ins</h2>
          <a href="#/quiz" className="btn btn-soft btn-sm">Take the check-in</a>
        </div>
        {progress.checkins.length === 0 ? (
          <div className="empty" data-reveal><p>No check-ins yet. Eight quick questions suggest which theme can help most.</p></div>
        ) : (
          <ul className="history">
            {progress.checkins.map((c) => {
              const th = themeById(c.themeId);
              return (
                <li key={c.at}>
                  <span className="muted">{formatDate(c.at)}</span>
                  <span className="history-area">{th.area}</span>
                  <a href={`#/teachings/${th.id}`}>{th.name} →</a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
