# EKAGRA
The only reel generator you need for learning the quotations of Swami Vivekananda Ji

Verified teachings of Swami Vivekananda, turned into honest 30–60 second reels.

This folder is the real website. Right now it has the **login page** (log in, create an account, continue with Google, forgot password) in English, Hindi, Bengali and Tamil.

## Run it on your computer

1. Install **Node.js** (the "LTS" version) from https://nodejs.org if you don't have it.
2. Unzip this folder, open a terminal inside it, and run:

   ```
   npm install
   npm run dev
   ```

3. Open the address it prints (usually http://localhost:5173) in your browser.

## Turn on real login (Firebase)

1. In the Firebase console, create a project, then go to **Authentication → Sign-in method** and enable **Email/Password** and **Google**.
2. In **Project settings → Your apps**, add a **Web app** and copy its `firebaseConfig` values.
3. Paste them into `src/firebase.js`, replacing the `PASTE_...` lines, and save.
4. In **Authentication → Settings → Authorized domains**, make sure `localhost` is listed (it is by default).

Until step 3 is done, the page still runs and looks complete; pressing a login button just shows a "not connected yet" message.

## Where things are

- `src/pages/Login.jsx` — the login page
- `src/data/content.js` — all page text and the "From his life" cards, in four languages
- `src/data/messages.js` — error and status messages
- `src/styles.css` — the EKAGRA theme (colours, fonts, layout)
- `src/firebase.js` — Firebase connection
