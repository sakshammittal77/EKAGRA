import { useMemo, useState } from 'react';
import { THEMES, themeById } from '../data/teachings.js';
import { QuoteCard, ThemeGrid } from '../components/Cards.jsx';
import { useLibrary } from '../lib/library.js';
import { useToast } from '../components/Toast.jsx';

export default function Teachings({ themeId, progress }) {
  const theme = themeId ? themeById(themeId) : null;
  const lib = useLibrary();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('todo'); // 'todo' | 'done'
  const [toastNode, toast] = useToast();
  const counts = useMemo(() => Object.fromEntries(THEMES.map((t) => [t.id, lib.forTheme(t.id).length])), [lib.quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!theme) {
    return (
      <div className="page">
        <section className="hello" data-reveal>
          <div>
            <span className="eyebrow">Library · {lib.quotes.length || 40} verified passages</span>
            <h1 className="page-title">Pick a theme.</h1>
            <p className="lead">Word for word from The Complete Works, each linked to its source.</p>
          </div>
          {progress.learned.length > 0 && <a href="#/history" className="btn btn-soft">History · {progress.learned.length} learned</a>}
        </section>
        <ThemeGrid counts={counts} />
      </div>
    );
  }

  const all = lib.forTheme(theme.id);
  const done = all.filter((t) => progress.isLearned(t.id));
  const todo = all.filter((t) => !progress.isLearned(t.id));
  const match = (t) => !q || `${t.text} ${t.situations || ''}`.toLowerCase().includes(q.toLowerCase());
  const items = (tab === 'todo' ? todo : done).filter(match);

  function toggle(t) {
    const nowLearned = !progress.isLearned(t.id);
    progress.toggleLearned(t.id);
    toast(nowLearned
      ? { text: 'Moved to History', href: '#/history', link: 'View', action: 'Undo', onAction: () => progress.toggleLearned(t.id) }
      : { text: 'Moved back to To learn', action: 'Undo', onAction: () => progress.toggleLearned(t.id) });
  }

  return (
    <div className="page">
      <a href="#/teachings" className="back-link">← All themes</a>
      <section className="hello" data-reveal>
        <div>
          <span className="eyebrow">{theme.area} · {done.length}/{all.length} learned</span>
          <h1 className="page-title">{theme.name} <span className="title-hi" lang="hi">{theme.hi}</span></h1>
          <p className="lead">{theme.blurb}</p>
        </div>
        <input className="input search" type="search" placeholder="Search these passages…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search passages" />
      </section>
      {!lib.live && !lib.loading && <p className="notice error">The backend is offline, so placeholder text is shown instead of the verified passages.</p>}

      <div className="seg-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'todo'} className={tab === 'todo' ? 'on' : ''} onClick={() => setTab('todo')}>
          To learn <span className="count">{todo.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>
          Learned <span className="count">{done.length}</span>
        </button>
      </div>

      <div className="quote-grid" key={tab}>
        {items.map((t, i) => (
          <QuoteCard key={t.id} index={i} teaching={t} themeId={theme.id} label={t.theme || theme.name}
            learned={progress.isLearned(t.id)} exitOnToggle onToggle={() => toggle(t)} />
        ))}
      </div>
      {!items.length && lib.quotes.length > 0 && (
        <div className="empty">
          {q ? <p>Nothing matches “{q}”.</p>
            : tab === 'todo' ? <><h3>All {all.length} learned 🎉</h3><p>Every passage in {theme.name} is in your History.</p><a href="#/history" className="btn btn-soft">Open History</a></>
              : <p>Nothing learned here yet. Press <b>Mark learned</b> on a passage you've understood.</p>}
        </div>
      )}
      {toastNode}
    </div>
  );
}
