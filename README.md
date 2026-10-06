# EKAGRA
The only reel generator you need for learning the quotations of Swami Vivekananda Ji

Verified teachings of Swami Vivekananda, turned into honest 30–60 second reels.

## Project layout

- `frontend/` — the website (React + Vite + Firebase login)
- `backend/` — the API service (FastAPI + MongoDB, reel rendering)

## Frontend

The website currently has:

- **Login page**: log in, create an account, continue with Google, forgot password, in English, Hindi, Bengali and Tamil
- **Home**: greeting, the Ask EKAGRA box (the AI assistant will plug in here later), check-in, learning journey and themes
- **How are you feeling? check-in**: 8 questions that suggest which theme can help most
- **Teachings**: 5 themes, each with quotes you can mark as learned
- **My learning**: progress by area, quotes learned and check-in history (saved in the browser for now)
- **My reels**: start a new reel (pick a theme and a teaching); making the video is coming soon

All quotes are **placeholders** for now. Replace them in `frontend/src/data/teachings.js` with verified quotations.

Login is required to see the pages after login. (For local development only, a developer can enable a demo mode by creating `frontend/.env.local` with `VITE_ENABLE_DEMO=true`; it is off by default and never active in the published site.)

### Run the website on your computer

1. Install **Node.js** (the "LTS" version) from https://nodejs.org if you don't have it.
2. Open a terminal in the **`frontend`** folder and run:

   ```
   npm install
   npm run dev
   ```

3. Open http://localhost:5173 in your browser.

### Firebase login

The site is connected to the Firebase project `ekagra-dfe37` (Email/Password and Google sign-in). For Google sign-in on `localhost:5173`, the Google Cloud OAuth web client must list `http://localhost:5173` as an authorized JavaScript origin and `http://localhost:5173/__/auth/handler` as an authorized redirect URI.

### Where things are (inside `frontend/`)

- `src/pages/Login.jsx` — the login page
- `src/pages/` — Home, MyLearning, Teachings, MyReels, NewReel, Quiz
- `src/data/teachings.js` — themes and (placeholder) quotes
- `src/data/quiz.js` — check-in questions and results
- `src/lib/progress.js` — saves each student's progress
- `src/data/content.js` — login page text and the "From his life" cards, in four languages
- `src/data/messages.js` — error and status messages
- `src/styles.css`, `src/app.css` — the EKAGRA theme (colours, fonts, layout)
- `src/firebase.js` — Firebase connection
- `vite.config.js` — dev server settings (including the Google sign-in fix)
