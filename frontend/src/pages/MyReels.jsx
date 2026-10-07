import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteReel, listMyReels } from '../lib/api.js';
import ReelPlayer from '../components/ReelPlayer.jsx';

function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function Poster({ r, i, onOpen }) {
  const hook = r.scenes?.[0]?.on_screen_text || r.scenes?.[0]?.voiceover_text || r.teachingTitle;
  return (
    <button type="button" className="poster" onClick={onOpen}
      data-reveal style={{ '--d': `${(i % 4) * 0.06}s` }}>
      <span className="poster-bg" aria-hidden="true" />
      <span className="poster-top"><span>EKAGRA</span><span>{r.durationSeconds}s · {String(r.language || '').toUpperCase()}</span></span>
      <span className="poster-hook" lang={r.language}>{hook}</span>
      <span className="poster-quote">“{r.authenticQuote}”</span>
      <span className="poster-foot">✓ Verbatim · {formatDate(r.createdAt)}</span>
      <span className="poster-play" aria-hidden="true">▶</span>
    </button>
  );
}

export default function MyReels({ backend }) {
  const [reels, setReels] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const userId = backend?.backendUser?.id;

  useEffect(() => {
    if (backend?.status === 'connecting') return;
    if (!userId) { setReels([]); return; }
    listMyReels(userId)
      .then((res) => setReels(res.reels || []))
      .catch(() => { setReels([]); setError("Couldn't load your reels right now."); });
  }, [userId, backend?.status]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function remove(r) {
    try {
      await deleteReel(r._id);
      setReels((list) => list.filter((x) => x._id !== r._id));
      setOpen(null);
    } catch { setError('Could not delete that reel.'); }
    setConfirm(false);
  }

  return (
    <div className="page">
      <section className="hello" data-reveal>
        <div>
          <span className="eyebrow">My reels{reels ? ` · ${reels.length}` : ''}</span>
          <h1 className="page-title">Your reels.</h1>
        </div>
        <a href="#/reels/new" className="btn btn-primary">+ Start a new reel</a>
      </section>

      {backend?.status === 'connecting' && <p className="notice ok" role="status">Connecting to the reel maker…</p>}
      {backend?.status === 'offline' && (
        <p className="notice error" role="status">
          The reel maker isn't reachable right now, so saved reels can't be shown.{' '}
          <button type="button" className="link-btn" onClick={() => backend.reconnect()}>Try again</button>
        </p>
      )}
      {error && <p className="notice error" role="status">{error}</p>}

      {reels === null ? (
        <div className="reel-grid">{[0, 1, 2, 3].map((k) => <div key={k} className="poster skeleton" />)}</div>
      ) : reels.length === 0 ? (
        <div className="empty" data-reveal>
          <h3>No reels yet</h3>
          <p className="muted">Pick a theme, describe a real moment, and get a reel built on his exact words.</p>
          <a href="#/reels/new" className="btn btn-soft">+ Start a new reel</a>
        </div>
      ) : (
        <div className="reel-grid">
          {reels.map((r, i) => <Poster key={r._id} r={r} i={i} onOpen={() => setOpen(r)} />)}
        </div>
      )}

      {open && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-label="Reel preview" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="modal-card">
            <button type="button" className="modal-x" onClick={() => setOpen(null)} aria-label="Close">✕</button>
            <ReelPlayer reel={open} autoPlay />
            <div className="modal-info">
              <span className="eyebrow">{formatDate(open.createdAt)}</span>
              <h3>{open.teachingTitle}</h3>
              <a href={open.sourceUrl} target="_blank" rel="noreferrer" className="small">{open.sourceCitation} ↗</a>
              {open.takeawayAction && <p className="takeaway-line"><b>Try this:</b> {open.takeawayAction}</p>}
              {open.videoUrl && open.renderStatus === 'succeeded' && <a href={open.videoUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-soft">Cloud MP4 ↗</a>}
              <div className="row-btns">
                {confirm
                  ? <><button type="button" className="btn btn-sm btn-danger" onClick={() => remove(open)}>Yes, delete</button><button type="button" className="btn btn-sm btn-soft" onClick={() => setConfirm(false)}>Keep</button></>
                  : <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirm(true)}>Delete reel</button>}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
