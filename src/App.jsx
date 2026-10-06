import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase.js';
import Login from './pages/Login.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(isFirebaseConfigured);

  // Firebase tells us whenever someone logs in or out.
  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
  }, []);

  if (checking) return null;
  if (!user) return <Login />;

  // Temporary screen after login. The real home screen is the next step.
  return (
    <div className="signed-in">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <span className="auth-eyebrow">EKAGRA</span>
        <h1 className="auth-title" style={{ fontSize: 32 }}>
          Signed in as<br />{user.displayName || user.email}
        </h1>
        <p className="muted">Next, we will build the home screen here.</p>
        <button type="button" className="btn-primary" onClick={() => signOut(auth)}>Log out</button>
      </div>
    </div>
  );
}
