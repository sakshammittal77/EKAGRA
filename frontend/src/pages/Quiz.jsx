import { useState } from 'react';
import { ANSWERS, QUESTIONS, RESULT_TEXT, scoreQuiz } from '../data/quiz.js';
import { themeById } from '../data/teachings.js';
import { saveQuestionnaire } from '../lib/api.js';

// How a check-in result maps onto the backend's personalization profile.
const PROFILE_FOR_THEME = {
  courage: { challenges: ['stage_fear', 'fear_of_failure'], interests: ['courage'] },
  concentration: { challenges: ['lack_of_focus'], interests: ['concentration'] },
  'self-confidence': { challenges: ['self_doubt'], interests: ['self_confidence'] },
  education: { challenges: ['low_motivation'], interests: ['education'] },
  service: { challenges: ['lack_of_purpose'], interests: ['service'] },
};

export default function Quiz({ progress, backend }) {
  const [step, setStep] = useState(0); // 0..QUESTIONS.length-1, then result
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const q = QUESTIONS[step];
  const chosen = q ? answers[q.id] : undefined;

  function choose(points) {
    setAnswers((a) => ({ ...a, [q.id]: points }));
  }

  function next() {
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }
    const r = scoreQuiz(answers);
    setResult(r);
    progress.addCheckin(r.top);

    // Save the check-in to the student's profile on the backend (if it's running).
    const userId = backend?.backendUser?.id;
    if (userId) {
      const map = PROFILE_FOR_THEME[r.top];
      saveQuestionnaire(userId, {
        life_stage: 'college_student',
        primary_challenges: map.challenges,
        interests: map.interests,
        questionnaire_responses: QUESTIONS.map((q) => ({
          question_key: q.id,
          question_text: q.text,
          selected_option: ANSWERS.find((a) => a.points === answers[q.id])?.label || '',
        })),
      }).catch(() => {});
    }
  }

  function restart() {
    setAnswers({});
    setResult(null);
    setStep(0);
  }

  if (result) {
    const theme = themeById(result.top);
    return (
      <div className="page narrow">
        <section className="quiz-card">
          <span className="eyebrow">Your check-in</span>
          <h1 className="page-title">{theme.area}</h1>
          <p className="lead">{RESULT_TEXT[theme.id]}</p>
          <div className="quiz-actions">
            <a href={`#/teachings/${theme.id}`} className="btn-primary btn-link">Explore {theme.name.toLowerCase()} teachings</a>
            <button type="button" className="btn-secondary" onClick={restart}>Take it again</button>
          </div>
          <p className="care-note">
            This check-in is for self-reflection, not a medical test. If you've been feeling low or anxious for a long
            time, please talk to someone you trust: a parent, teacher, friend or school counsellor.
          </p>
        </section>
      </div>
    );
  }

  const pct = Math.round((step / QUESTIONS.length) * 100);

  return (
    <div className="page narrow">
      <a href="#/home" className="back-link">← Back to home</a>
      <section className="quiz-card">
        <div className="quiz-progress-row">
          <span className="eyebrow">How are you feeling?</span>
          <span className="muted small">Question {step + 1} of {QUESTIONS.length}</span>
        </div>
        <div className="track-bar" role="progressbar" aria-label="Check-in progress"
          aria-valuenow={step} aria-valuemin={0} aria-valuemax={QUESTIONS.length}>
          <div style={{ width: `${pct}%` }} />
        </div>

        <h1 className="quiz-question" key={q.id}>{q.text}</h1>

        <div className="answers" role="radiogroup" aria-label="Your answer">
          {ANSWERS.map((a) => (
            <button
              key={a.label}
              type="button"
              role="radio"
              aria-checked={chosen === a.points}
              className={`answer${chosen === a.points ? ' selected' : ''}`}
              onClick={() => choose(a.points)}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="quiz-actions">
          <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          <button type="button" className="btn-primary" disabled={chosen === undefined} onClick={next}>
            {step === QUESTIONS.length - 1 ? 'See my result' : 'Next'}
          </button>
        </div>
      </section>
    </div>
  );
}
