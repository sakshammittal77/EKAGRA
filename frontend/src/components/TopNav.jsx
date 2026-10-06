const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'learning', label: 'My learning' },
  { id: 'teachings', label: 'Teachings' },
  { id: 'reels', label: 'My reels' },
];

export default function TopNav({ page, userName, onLogout }) {
  const initial = (userName || '?').trim().charAt(0).toUpperCase();
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <a href="#/home" className="brand" aria-label="EKAGRA home">
          <span className="brand-name" style={{ fontSize: 24 }}>EKAGRA</span>
          <span className="brand-hindi" lang="hi" style={{ fontSize: 18 }}>एकाग्र</span>
        </a>
        <nav className="tabs" aria-label="Main">
          {TABS.map((tab) => (
            <a
              key={tab.id}
              href={`#/${tab.id}`}
              className={`tab${page === tab.id ? ' active' : ''}`}
              aria-current={page === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </a>
          ))}
        </nav>
        <div className="topnav-user">
          <span className="avatar" title={userName}>{initial}</span>
          <button type="button" className="logout" onClick={onLogout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
