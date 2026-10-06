import { useCallback, useEffect, useRef, useState } from 'react';
import { startSession, API_URL } from './api.js';

// After login, registers the user with the backend and remembers their backend id.
// The free backend sleeps when unused and takes up to ~50s to wake up, so we retry.
// status: 'connecting' | 'online' | 'offline'
const RETRY_DELAYS = [0, 5000, 15000, 30000];

export function useBackendSession(user, enabled = true) {
  const [state, setState] = useState({ status: 'connecting', backendUser: null, error: '' });
  const attemptRef = useRef(0);

  const connect = useCallback(async () => {
    if (!user || !enabled) {
      setState({ status: 'offline', backendUser: null, error: 'disabled' });
      return null;
    }
    const myAttempt = ++attemptRef.current;
    setState((s) => ({ ...s, status: 'connecting' }));
    let lastError = '';
    for (const delay of RETRY_DELAYS) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (myAttempt !== attemptRef.current) return null; // a newer attempt took over
      try {
        const backendUser = await startSession();
        if (myAttempt !== attemptRef.current) return null;
        setState({ status: 'online', backendUser, error: '' });
        return backendUser;
      } catch (err) {
        lastError = err.message || String(err);
        console.info(`EKAGRA backend (${API_URL}) not ready yet:`, lastError);
        // Login problems won't fix themselves by retrying.
        if (/^(401|403)/.test(lastError)) break;
      }
    }
    if (myAttempt === attemptRef.current) setState({ status: 'offline', backendUser: null, error: lastError });
    return null;
  }, [user?.uid, enabled]);

  useEffect(() => {
    connect();
    return () => { attemptRef.current += 1; }; // cancel on logout / user change
  }, [connect]);

  return { ...state, reconnect: connect };
}
