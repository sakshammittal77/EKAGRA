# EKAGRA
The only reel generator you need for learning the quotations of Swami Vivekananda Ji

Verified teachings of Swami Vivekananda, turned into honest 30–60 second reels.

## Project layout

- `frontend/` — the website (React + Vite + Firebase login)
- `backend/` — the API service (FastAPI + MongoDB, reel rendering)

## Run everything locally (no Firebase, no MongoDB needed)

1. Backend (Python 3.11+), in `backend/`:
   ```
   python -m venv .venv
   .venv/Scripts/pip install -r requirements.txt mongomock-motor
   ```
   Create `backend/.env`:
   ```
   MONGODB_URI=memory        # in-memory database, wiped when the server stops
   DEV_AUTH=true             # accepts "dev:<name>" tokens instead of Firebase (local only!)
   ALLOWED_ORIGINS=http://localhost:5173
   ```
   Start it: `.venv/Scripts/python -m uvicorn main:app --port 8010`
2. Frontend, in `frontend/`: create `frontend/.env.local`:
   ```
   VITE_ENABLE_DEMO=true
   VITE_API_URL=http://localhost:8010
   ```
   then `npm install` and `npm run dev`.
3. Open http://localhost:5173/?demo=YourName (skips login and uses the local backend).

Without `GEMINI_API_KEY` the scripts come from theme-aware templates in English, Hindi, Bengali and Tamil (`backend/services/templates.py`).

## What's new in this version

- **Dark HUD redesign** with a Three.js particle hero (a scattered "distracted mind" that gathers into one word), a scroll-driven "anatomy of a reel" 3D layer stack, a custom cursor, magnetic buttons, tilt cards, scramble text and scroll reveals.
- **Arya, the talking guide**: an illustrated narrator on every page who explains it out loud (browser speech, English or Hindi), with lip-sync and blinking. Swami Vivekananda is deliberately *not* animated or given AI lines.
- **Reel studio**: live passage matching while you type, pin a passage, a 9:16 canvas player (kinetic captions, verified badge), voice preview, an ambient soundtrack, **.webm export in the browser**, editable AI-written scenes (his words are locked), alternative hooks, SRT/VTT download, a ready-to-post caption, and a one-click remix into another language.
- **Ask EKAGRA works**: it shows the verified passages that fit what you typed.
- **Fact check**: paste a viral "Vivekananda quote" to get verified / almost / paraphrase / misattributed / not found, with a word diff and the real passage.
- **Teachings use the real verified library** (40 passages) instead of placeholders.
- **Natural narration**: `POST /api/tts` uses Microsoft neural voices via `edge-tts` (free, no key, needs internet) for Arya and the reels, with word timings for highlighting. The narration is recorded into the exported `.webm`. Without internet it falls back to the browser's voice.
- **Care check**: if a situation suggests self-harm, the Tele-MANAS helpline (14416) is shown.

## Frontend

The website currently has:

- **Login page**: log in, create an account, continue with Google, forgot password, in English, Hindi, Bengali and Tamil
- **Home**: greeting, the Ask EKAGRA box (the AI assistant will plug in here later), check-in, learning journey and themes
- **How are you feeling? check-in**: 8 questions that suggest which theme can help most
- **Teachings**: 5 themes, each with quotes you can mark as learned
- **My learning**: progress by area, quotes learned and check-in history (saved in the browser for now)
- **My reels**: make a reel (pick a theme, describe your situation, choose language and length) → script → video; saved reels are listed

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

## How the frontend and backend connect

- Login happens only in **Firebase** (Google or email + password) on the website. The backend never handles passwords.
- After login, the website calls `POST /api/auth/session` with the user's Firebase ID token (`Authorization: Bearer <token>`). The backend checks the token (`backend/auth.py`) and creates or finds that user in MongoDB.
- Every user endpoint checks the token and only lets a student see their own data.
- Connected: the **check-in** saves to the student's profile, the **Ask EKAGRA** box saves the question, and **reel making** calls `POST /api/reels/generate-tailored` then `POST /api/reels/{id}/render-video`. My reels lists `GET /api/reels/user/{id}`.
- The script currently comes from the backend's template text until the LLM is connected in `backend/services/llm_client.py`; the video is a sample until `CREATOMATE_API_KEY` is set.
- If the backend isn't running, the website still works on its own.

### Run the backend locally

1. Install Python 3.11+ and MongoDB (or use a free MongoDB Atlas database).
2. In the `backend` folder: `pip install -r requirements.txt`
3. Optional `backend/.env`: `MONGODB_URI=...`, `CREATOMATE_API_KEY=...`, `ALLOWED_ORIGINS=http://localhost:5173` (add the Vercel address when deployed), `FIREBASE_PROJECT_ID=ekagra-dfe37`
4. Start it: `uvicorn main:app --reload --port 8000`

The website looks for the backend at `http://localhost:8000`. To use another address, create `frontend/.env.local` with `VITE_API_URL=https://your-backend-address`.

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
- `src/lib/api.js` — calls to the backend (sends the Firebase token)
- `vite.config.js` — dev server settings (including the Google sign-in fix)
