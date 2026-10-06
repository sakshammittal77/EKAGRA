import { useEffect, useState } from 'react';
import { listMyReels } from '../lib/api.js';

function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyReels({ backend }) {
  const [reels, setReels] = useState(null); // null = loading
  const [error, setError] = useState('');
  const userId = backend?.backendUser?.id;

  useEffect(() => {
    if (backend?.status === 'connecting') return;
    if (!userId) { setReels([]); return; }
    listMyReels(userId)
      .then((res) => setReels(res.reels || []))
      .catch(() => { setReels([]); setError("Couldn't load your reels right now."); });
  }, [userId, backend?.status]);

  return (
    <div className="page">
      <section className="hello">
        <div>
          <span className="eyebrow">My reels</span>
          <h1 className="page-title">Your reels.</h1>
          <p className="lead">Reels you make from teachings are saved here, ready to share.</p>
        </div>
        <a href="#/reels/new" className="btn-primary btn-link">+ Start a new reel</a>
      </section>

      {backend?.status === 'connecting' && (
        <p className="notice ok" role="status">Waking up the reel maker… this can take up to a minute the first time.</p>
      )}
      {backend?.status === 'offline' && (
        <p className="notice error" role="status">
          The reel maker isn't reachable right now, so saved reels can't be shown.{' '}
          <button type="button" className="link-btn" style={{ fontSize: 'inherit', color: 'inherit', fontWeight: 600 }}
            onClick={() => backend.reconnect()}>Try again</button>
          {backend?.error && <span className="small" style={{ display: 'block', opacity: 0.8 }}>Details: {backend.error}</span>}
        </p>
      )}
      {error && <p className="notice error" role="status">{error}</p>}

      {reels === null ? (
        <p className="muted">Loading your reels…</p>
      ) : reels.length === 0 ? (
        <div className="empty">
          <div className="reel-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="8 5 19 12 8 19 8 5" /></svg>
          </div>
          <h3>No reels yet</h3>
          <p className="muted">Start a new reel by picking a theme and describing your situation.</p>
          <a href="#/reels/new" className="btn-secondary btn-link">+ Start a new reel</a>
        </div>
      ) : (
        <div className="reel-grid">
          {reels.map((r) => (
            <article key={r._id} className="reel-card">
              <div className="reel-thumb" aria-hidden="true">
                {r.videoUrl && r.renderStatus === 'succeeded'
                  ? <video src={r.videoUrl} muted playsInline preload="metadata" />
                  : <span className="muted small">Script only</span>}
              </div>
              <div className="reel-info">
                <h3 className="track-name">{r.teachingTitle || 'Reel'}</h3>
                <span className="muted small">{formatDate(r.createdAt)} · {r.durationSeconds}s · {String(r.language || '').toUpperCase()}</span>
                <p className="reel-quote">“{r.authenticQuote}”</p>
                {r.sourceCitation && (
                  <span className="muted small">
                    {r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer">{r.sourceCitation}</a> : r.sourceCitation}
                  </span>
                )}
                {r.videoUrl && r.renderStatus === 'succeeded' && <a href={r.videoUrl} target="_blank" rel="noreferrer">Watch video</a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
