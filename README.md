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
