import { useEffect, useState } from 'react';
import { startSession } from './api.js';

// After login, registers the user with the backend and remembers their backend id.
// status: 'connecting' | 'online' | 'offline'
export function useBackendSession(user, enabled = true) {
  const [state, setState] = useState({ status: 'connecting', backendUser: null });

  useEffect(() => {
    if (!user || !enabled) { setState({ status: 'offline', backendUser: null }); return undefined; }
    let cancelled = false;
    setState({ status: 'connecting', backendUser: null });
    startSession()
      .then((backendUser) => { if (!cancelled) setState({ status: 'online', backendUser }); })
      .catch((err) => {
        if (!cancelled) setState({ status: 'offline', backendUser: null });
        console.info('EKAGRA backend not reachable, continuing without it:', err.message);
      });
    return () => { cancelled = true; };
  }, [user?.uid, enabled]);

  return state;
}
