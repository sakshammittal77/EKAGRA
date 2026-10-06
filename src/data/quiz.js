// "How are you feeling?" check-in.
// Each answer adds points to one theme. The theme with the most points
// is suggested at the end. This is a gentle self-reflection tool, not a
// medical or psychological test.

export const ANSWERS = [
  { label: 'Never', points: 0 },
  { label: 'Sometimes', points: 1 },
  { label: 'Often', points: 2 },
  { label: 'Almost always', points: 3 },
];

export const QUESTIONS = [
  { id: 'q1', themeId: 'courage', text: 'Before exams or tests, I feel nervous or my heart races.' },
  { id: 'q2', themeId: 'courage', text: "I stay quiet in class even when I know the answer, because I'm afraid of being wrong." },
  { id: 'q3', themeId: 'concentration', text: 'My mind wanders when I sit down to study.' },
  { id: 'q4', themeId: 'concentration', text: 'I keep switching between my phone and my work.' },
  { id: 'q5', themeId: 'self-confidence', text: "I feel I'm not as good as the people around me." },
  { id: 'q6', themeId: 'self-confidence', text: 'When something goes wrong, I mostly blame myself.' },
  { id: 'q7', themeId: 'education', text: 'I study only for marks, not because I enjoy learning.' },
  { id: 'q8', themeId: 'service', text: 'I wish my life had a bigger purpose, like helping others.' },
];

// What we say for each result. Written by the team — not his words.
export const RESULT_TEXT = {
  courage:
    'It sounds like fear and nervousness are weighing on you. That is very common, especially around exams and speaking up. Teachings on courage can help you face these moments.',
  concentration:
    'It sounds like staying focused is hard right now. A wandering mind is normal, and it can be trained. Teachings on concentration are a good place to start.',
  'self-confidence':
    'It sounds like you are doubting yourself. Many students feel this way. Teachings on self-confidence can help you see your own strength.',
  education:
    'It sounds like studying feels like a burden rather than a joy. Teachings on education explore what learning is really for.',
  service:
    'It sounds like you are looking for a bigger purpose. Teachings on service show how helping others can give life meaning and strength.',
};

// Returns { scores: {themeId: n}, top: themeId, total }
export function scoreQuiz(answers) {
  const scores = {};
  QUESTIONS.forEach((q) => {
    scores[q.themeId] = (scores[q.themeId] || 0) + (answers[q.id] ?? 0);
  });
  // Themes with two questions are averaged so each theme counts equally.
  const counts = {};
  QUESTIONS.forEach((q) => { counts[q.themeId] = (counts[q.themeId] || 0) + 1; });
  let top = null;
  let best = -1;
  Object.keys(scores).forEach((id) => {
    const avg = scores[id] / counts[id];
    if (avg > best) { best = avg; top = id; }
  });
  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  return { scores, top, total };
}
