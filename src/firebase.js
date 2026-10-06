// Firebase setup for EKAGRA.
//
// STEP: paste your own values from
// Firebase console → Project settings → Your apps → Web app → "firebaseConfig".
// These values are public identifiers, not passwords, so they are safe in this file.

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyC5B8eefX_koDKwwIy1sM5gesWbSmAaWek',
  authDomain: 'ekagra-dfe37.firebaseapp.com',
  projectId: 'ekagra-dfe37',
  storageBucket: 'ekagra-dfe37.firebasestorage.app',
  messagingSenderId: '201559523260',
  appId: '1:201559523260:web:73d5f30131fd384d23b5b9',
};

// True once real values have been pasted above.
export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('PASTE_');

let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

export { auth, googleProvider };
