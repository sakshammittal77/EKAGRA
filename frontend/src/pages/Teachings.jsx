import { themeById, teachingsForTheme } from '../data/teachings.js';
import { QuoteCard, ThemeGrid } from '../components/Cards.jsx';

export default function Teachings({ themeId, progress }) {
  const theme = themeId ? themeById(themeId) : null;

  if (!theme) {
    return (
      <div className="page">
        <section className="hello">
          <div>
            <span className="eyebrow">Teachings</span>
            <h1 className="page-title">Pick a theme.</h1>
            <p className="lead">Each theme gathers verified quotations on one part of life.</p>
          </div>
        </section>
        <ThemeGrid />
      </div>
    );
  }

  const items = teachingsForTheme(theme.id);
  const done = items.filter((t) => progress.isLearned(t.id)).length;

  return (
    <div className="page">
      <a href="#/teachings" className="back-link">← All themes</a>
      <section className="hello">
        <div>
          <span className="eyebrow">{theme.area}</span>
          <h1 className="page-title">{theme.name} <span className="title-hi" lang="hi">{theme.hi}</span></h1>
          <p className="lead">{theme.blurb} You've learned {done} of {items.length}.</p>
        </div>
      </section>
      <div className="quote-grid">
        {items.map((t, i) => (
          <QuoteCard key={t.id} teaching={t} label={`Teaching ${i + 1}`}
            learned={progress.isLearned(t.id)} onToggle={() => progress.toggleLearned(t.id)} />
        ))}
      </div>
    </div>
  );
}
