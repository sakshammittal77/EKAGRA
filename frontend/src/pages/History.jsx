import { useMemo } from 'react';
import { QuoteCard } from '../components/Cards.jsx';
import { useLibrary } from '../lib/library.js';
import { useToast } from '../components/Toast.jsx';

// Everything the student has marked as learned, newest first, grouped by day.

function dayLabel(iso) {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function History({ progress }) {
  const lib = useLibrary();
  const [toastNode, toast] = useToast();

  const groups = useMemo(() => {
    const items = lib.quotes
      .filter((q) => progress.learned.includes(q.id))
      .map((q) => ({ q, at: progress.learnedAt[q.id] || null }))
      .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    const out = [];
    items.forEach((it) => {
      const label = dayLabel(it.at);
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(it); else out.push({ label, items: [it] });
    });
    return out;
  }, [lib.quotes, progress.learned, progress.learnedAt]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  function unmark(q) {
    progress.toggleLearned(q.id);
    toast({ text: 'Removed from History', action: 'Undo', onAction: () => progress.toggleLearned(q.id) });
  }

  return (
    <div className="page">
      <section className="hello" data-reveal>
        <div>
          <span className="eyebrow">History · {total} of {lib.quotes.length || 40} passages learned</span>
          <h1 className="page-title">Everything you've learned.</h1>
        </div>
        <a href="#/teachings" className="btn btn-soft">Keep learning →</a>
      </section>

      {total === 0 ? (
        <div className="empty" data-reveal>
          <h3>Nothing here yet</h3>
          <p>Open a theme and press <b>Mark learned</b> on a passage you've understood. It will show up here.</p>
          <a href="#/teachings" className="btn btn-dark">Go to Teachings</a>
        </div>
      ) : groups.map((g) => (
        <section key={g.label}>
          <h2 className="history-day">{g.label} <small>{g.items.length} passage{g.items.length > 1 ? 's' : ''}</small></h2>
          <div className="quote-grid">
            {g.items.map(({ q, at }, i) => (
              <QuoteCard key={q.id} index={i} teaching={q} learned exitOnToggle onToggle={() => unmark(q)}
                note={at ? `${q.theme} · ${new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : q.theme} />
            ))}
          </div>
        </section>
      ))}
      {toastNode}
    </div>
  );
}
