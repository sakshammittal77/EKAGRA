import { useEffect, useRef, useState } from 'react';
import { assistantChat } from '../lib/api.js';
import { go } from '../lib/router.js';

// "How are you feeling?" chat on the Home page.
// The reply is AI-written; the quote is always his exact words, picked by ID on the backend.

const EXAMPLES = ["I'm scared of exams", "I can't focus", "I don't believe in myself", 'I feel lonely in college'];

export function startReelFrom({ theme, situation }) {
  try { sessionStorage.setItem('ekagra.reelPrefill', JSON.stringify({ theme, situation })); } catch { /* ignore */ }
  go('reels/new');
}

function friendly(err) {
  const msg = String(err?.message || err);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return "I can't reach EKAGRA right now. Please try again in a minute.";
  if (msg.startsWith('401')) return 'Your login has expired. Please log out and log in again.';
  if (msg.startsWith('403')) return 'Please verify your email first, then log in again.';
  return 'Something went wrong. Please try again.';
}

function Reply({ m, onReel }) {
  if (m.crisis) {
    return (
      <div className="as-card as-crisis">
        <p className="as-reply">{m.reply}</p>
        <ul className="as-help">
          {m.helplines.map((h) => (
            <li key={h.phone}>
              <strong>{h.name}</strong>
              <a href={`tel:${h.phone}`} className="as-call">Call {h.phone}</a>
              {h.alt && <span className="as-alt">or {h.alt}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="as-card">
      {m.feeling && <span className="as-feeling">{m.feeling}</span>}
      <p className="as-reply">{m.reply}</p>
      {m.quote && (
        <figure className="as-quote">
          <span className="as-quote-label">Swami Vivekananda · his exact words</span>
          <blockquote>“{m.quote.text}”</blockquote>
          <figcaption><a href={m.quote.url} target="_blank" rel="noreferrer">{m.quote.source}</a></figcaption>
        </figure>
      )}
      {m.action && <p className="as-action"><strong>Try this today:</strong> {m.action}</p>}
      {m.theme && (
        <div className="as-buttons">
          <button type="button" className="as-btn" onClick={() => onReel(m)}>Make a reel about this →</button>
        </div>
      )}
    </div>
  );
}

export default function Assistant({ backend }) {
  const [thread, setThread] = useState([]); // {role:'user', text} | {role:'assistant', ...result}
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => { if (thread.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [thread, busy]);

  async function send(e) {
    e?.preventDefault();
    const msg = text.trim();
    if (!msg || busy) return;
    const next = [...thread, { role: 'user', text: msg }];
    setThread(next); setText(''); setError(''); setBusy(true);
    try {
      if (backend?.status !== 'online') await backend?.reconnect?.();
      const res = await assistantChat(
        next.map((m) => ({ role: m.role, text: m.role === 'user' ? m.text : m.reply })),
        thread.filter((m) => m.quote).map((m) => m.quote.id),
      );
      setThread([...next, { role: 'assistant', ...res }]);
    } catch (err) {
      setError(friendly(err));
      setThread(thread); setText(msg); // let them try again
    } finally {
      setBusy(false);
    }
  }

  function onReel(m) {
    const firstUser = [...thread].reverse().find((x) => x.role === 'user');
    startReelFrom({ theme: m.theme, situation: firstUser?.text || '' });
  }

  return (
    <div className="ask-form">
      {thread.length > 0 && (
        <div className="as-thread" aria-live="polite">
          {thread.map((m, i) => (m.role === 'user'
            ? <p key={i} className="as-user">{m.text}</p>
            : <Reply key={i} m={m} onReel={onReel} />))}
          {busy && <p className="as-typing">EKAGRA is thinking…</p>}
          <div ref={endRef} />
        </div>
      )}
      <form className="ask-row" onSubmit={send}>
        <label htmlFor="ask" className="sr-only">How are you feeling?</label>
        <input id="ask" className="input" type="text" value={text} maxLength={1000} disabled={busy}
          placeholder={thread.length ? 'Reply…' : 'e.g. I get nervous when I speak in class'}
          onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="ask-send" aria-label="Send" disabled={busy}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </button>
      </form>
      {thread.length === 0 && (
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>{ex}</button>
          ))}
        </div>
      )}
      {thread.length > 0 && !busy && (
        <button type="button" className="as-reset" onClick={() => { setThread([]); setError(''); }}>Start over</button>
      )}
      {error && <p className="ask-note" role="status">{error}</p>}
      <p className="as-disclaimer">EKAGRA is an AI companion, not a counsellor. If you're struggling a lot, please talk to someone you trust.</p>
    </div>
  );
}
