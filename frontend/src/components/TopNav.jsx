import { useEffect, useState } from 'react';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'reels', label: 'My reels' },
  { id: 'teachings', label: 'Teachings' },
  { id: 'history', label: 'History' },
  { id: 'factcheck', label: 'Fact check' },
  { id: 'learning', label: 'Progress' },
];

const STATUS = { online: 'Connected', connecting: 'Connecting…', offline: 'Backend offline' };

export default function TopNav({ page, userName, onLogout, backendStatus }) {
  const initial = (userName || '?').trim().charAt(0).toUpperCase();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [dark, setDark] = useState(false);

  // Hide while scrolling down, show again on scroll up, so the bar never sits over what you're
  // reading. Over dark sections ([data-nav-dark]) it switches to a dark style.
  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 8);
        if (Math.abs(y - lastY) > 6) { setHidden(y > lastY && y > 140); lastY = y; }
        const probe = 34;
        setDark([...document.querySelectorAll('[data-nav-dark]')].some((el) => {
          const r = el.getBoundingClientRect();
          return r.top <= probe && r.bottom >= probe;
        }));
      });
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    const onRoute = () => { setHidden(false); setTimeout(on, 80); }; // after the new page renders
    window.addEventListener('hashchange', onRoute);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('hashchange', onRoute); };
  }, []);

  return (
    <header className={`topnav${scrolled ? ' scrolled' : ''}${hidden ? ' hidden' : ''}${dark ? ' dark' : ''}`}
      onFocus={() => setHidden(false)}>
      <div className="topnav-inner">
        <a href="#/home" className="brand" aria-label="EKAGRA home">
          <span className="brand-name">EKAGRA</span>
          <span className="brand-hindi" lang="hi">एकाग्र</span>
        </a>
        <nav className="tabs" aria-label="Main">
          {TABS.map((tab) => (
            <a key={tab.id} href={`#/${tab.id}`} className={`tab${page === tab.id ? ' active' : ''}`}
              aria-current={page === tab.id ? 'page' : undefined}>
              {tab.label}
            </a>
          ))}
        </nav>
        <div className="topnav-user">
          <a href="#/reels/new" className="btn btn-primary btn-sm nav-cta">+ New reel</a>
          <span className="avatar" title={`${userName} · ${STATUS[backendStatus] || STATUS.offline}`}>
            {initial}
            <i className={`status ${backendStatus || 'offline'}`} aria-label={STATUS[backendStatus] || STATUS.offline} />
          </span>
          <button type="button" className="logout" onClick={onLogout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
