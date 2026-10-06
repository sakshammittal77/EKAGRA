import { useEffect, useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase.js';

const RESEND_WAIT = 60; // seconds between resends

// Shown after signing up with email + password, until the link in the email is clicked.
export default function VerifyEmail({ user, onVerified, onLogout }) {
  const [note, setNote] = useState(null); // { kind, text }
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_WAIT); // the first email was just sent

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function checkVerified() {
    setBusy(true); setNote(null);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        await auth.currentUser.getIdToken(true); // fresh token that says "verified"
        onVerified();
      } else {
        setNote({ kind: 'error', text: "We can't see the verification yet. Open the link in the email, then press this button again." });
      }
    } catch {
      setNote({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true); setNote(null);
    try {
      await sendEmailVerification(auth.currentUser, { url: window.location.origin });
      setNote({ kind: 'ok', text: 'A new verification email is on its way.' });
      setWait(RESEND_WAIT);
    } catch (err) {
      setNote({
        kind: 'error',
        text: err.code === 'auth/too-many-requests'
          ? 'Too many emails sent. Please wait a few minutes and try again.'
          : 'Could not send the email. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signed-in">
      <div className="auth-card verify-card">
        <span className="auth-eyebrow">One last step</span>
        <h1 className="auth-title" style={{ '--hsize': '32px' }}>Verify your email</h1>
        <p className="muted">
          We sent a link to <strong>{user.email}</strong>. Open it to confirm this email is yours, then come back here.
        </p>
        <p className="muted small">Can't find it? Check your Spam or Promotions folder. It comes from noreply@ekagra-dfe37.firebaseapp.com.</p>

        {note && <p className={`notice ${note.kind}`} role="status">{note.text}</p>}

        <div className="actions">
          <button type="button" className="btn-primary" onClick={checkVerified} disabled={busy}>I've verified my email</button>
          <button type="button" className="btn-google" onClick={resend} disabled={busy || wait > 0}>
            {wait > 0 ? `Resend email in ${wait}s` : 'Resend email'}
          </button>
        </div>
        <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={onLogout}>Use a different account</button>
      </div>
    </div>
  );
}
