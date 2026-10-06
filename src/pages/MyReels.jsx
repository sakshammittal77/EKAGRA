export default function MyReels() {
  return (
    <div className="page">
      <section className="hello">
        <div>
          <span className="eyebrow">My reels</span>
          <h1 className="page-title">Your reels.</h1>
          <p className="lead">Reels you make from teachings will be saved here, ready to share.</p>
        </div>
      </section>
      <div className="empty">
        <div className="reel-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="8 5 19 12 8 19 8 5" /></svg>
        </div>
        <h3>No reels yet</h3>
        <p className="muted">Reel making is coming soon. Meanwhile, explore the teachings you'd like to turn into a reel.</p>
        <a href="#/teachings" className="btn-secondary btn-link">Explore teachings</a>
      </div>
    </div>
  );
}
