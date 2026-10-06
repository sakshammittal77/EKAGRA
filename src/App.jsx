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

// While developing, open http://localhost:5173/?demo to skip login.
const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
const DEMO_USER = { uid: 'demo', displayName: 'Saksham', email: 'demo@ekagra.app' };

function Shell({ user, onLogout }) {
  const { page, param } = useRoute();
  const progress = useProgress(user.uid);
  const firstName = (user.displayName || user.email || 'friend').split(/[ @]/)[0];

  let content;
  switch (page) {
    case 'learning': content = <MyLearning progress={progress} />; break;
    case 'teachings': content = <Teachings themeId={param} progress={progress} />; break;
    case 'reels': content = <MyReels />; break;
    case 'quiz': content = <Quiz progress={progress} />; break;
    default: content = <Home firstName={firstName} progress={progress} />;
  }

  return (
    <div className="app">
      <TopNav page={page === 'quiz' ? 'home' : page} userName={user.displayName || user.email} onLogout={onLogout} />
      <main>{content}</main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(DEMO ? DEMO_USER : null);
  const [checking, setChecking] = useState(!DEMO && isFirebaseConfigured);

  // Firebase tells us whenever someone logs in or out.
  useEffect(() => {
    if (DEMO || !isFirebaseConfigured) return undefined;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
  }, []);

  if (checking) return null;
  if (!user) return <Login />;

  const logout = DEMO ? () => setUser(null) : () => signOut(auth);
  return <Shell user={user} onLogout={logout} />;
}
