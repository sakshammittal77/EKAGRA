import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase.js';
import { useRoute } from './lib/router.js';
import { useProgress } from './lib/progress.js';
import Login from './pages/Login.jsx';
import TopNav from './components/TopNav.jsx';
import Home from './pages/Home.jsx';
import MyLearning from './pages/MyLearning.jsx';
import Teachings from './pages/Teachings.jsx';
import MyReels from './pages/MyReels.jsx';
import Quiz from './pages/Quiz.jsx';
import NewReel from './pages/NewReel.jsx';
import FactCheck from './pages/FactCheck.jsx';
import History from './pages/History.jsx';
import { useBackendSession } from './lib/useBackend.js';
import { setDevUser } from './lib/api.js';
import VerifyEmail from './pages/VerifyEmail.jsx';
import FX from './fx/FX.jsx';
import { GuideDock } from './components/Guide.jsx';

// Demo mode (skip login) is OFF. It only turns on for local development when a
// developer deliberately creates a file named .env.local containing
// VITE_ENABLE_DEMO=true and opens the site with ?demo (or ?demo=YourName).
// It can never turn on in the built, published site. With the backend's
// DEV_AUTH=true, demo users also get a real (local) backend session.
const DEMO_PARAM = new URLSearchParams(window.location.search).get('demo');
const DEMO = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_DEMO === 'true'
  && DEMO_PARAM !== null;
const DEMO_USER = { uid: 'demo', displayName: DEMO_PARAM || 'Friend', email: 'demo@ekagra.app' };
if (DEMO) setDevUser(DEMO_USER.displayName);

function Shell({ user, onLogout }) {
  const { page, param } = useRoute();
  const progress = useProgress(user.uid);
  const backend = useBackendSession(user, true);
  const firstName = (user.displayName || user.email || 'friend').split(/[ @]/)[0];

  let content;
  switch (page) {
    case 'learning': content = <MyLearning progress={progress} backend={backend} />; break;
    case 'teachings': content = <Teachings themeId={param} progress={progress} />; break;
    case 'reels': content = param === 'new' ? <NewReel backend={backend} /> : <MyReels backend={backend} />; break;
    case 'quiz': content = <Quiz progress={progress} backend={backend} />; break;
    case 'factcheck': content = <FactCheck />; break;
    case 'history': content = <History progress={progress} />; break;
    default: content = <Home firstName={firstName} progress={progress} backend={backend} />;
  }

  return (
    <div className="app">
      <TopNav page={page === 'quiz' ? 'home' : page} userName={user.displayName || user.email}
        onLogout={onLogout} backendStatus={backend.status} />
      {/* key replays the page-enter animation on every route change */}
      <main key={`${page}/${param || ''}`} className="page-enter">{content}</main>
      {page !== 'home' && <GuideDock page={page} param={param} backend={backend} />}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(DEMO ? DEMO_USER : null);
  const [checking, setChecking] = useState(!DEMO && isFirebaseConfigured);
  const [, refresh] = useState(0); // re-render after the email gets verified

  // Firebase tells us whenever someone logs in or out.
  useEffect(() => {
    if (DEMO || !isFirebaseConfigured) return undefined;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
  }, []);

  let screen;
  const logout = DEMO ? () => setUser(null) : () => signOut(auth);
  if (checking) screen = null;
  else if (!user) screen = <div className="legacy-login"><Login /></div>;
  else {
    // Email + password accounts must verify their email first. Google accounts are already verified.
    const current = DEMO ? user : (auth.currentUser || user);
    const usesPassword = !DEMO && current.providerData?.some((p) => p.providerId === 'password');
    screen = usesPassword && !current.emailVerified
      ? <div className="legacy-login"><VerifyEmail user={current} onVerified={() => refresh((n) => n + 1)} onLogout={logout} /></div>
      : <Shell user={current} onLogout={logout} />;
  }

  return (
    <>
      <FX />
      {screen}
    </>
  );
}
