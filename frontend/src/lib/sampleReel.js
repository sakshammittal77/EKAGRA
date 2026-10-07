// A sample reel shown on the home page so visitors see what EKAGRA makes.
// The quote is copied exactly from backend/quotes_library.py (id: faith_in_yourselves);
// everything else is our own example script.

export const SAMPLE_REEL = {
  _id: 'sample',
  language: 'en',
  durationSeconds: 30,
  teachingId: 'faith_in_yourselves',
  authenticQuote: 'Have faith in yourselves, and stand up on that faith and be strong; that is what we need.',
  sourceCitation: 'The Complete Works of Swami Vivekananda, Vol. 3, Lectures from Colombo to Almora, "The Mission of the Vedanta"',
  scenes: [
    { scene_number: 1, name: 'Hook', start_time: 0, end_time: 4, on_screen_text: 'Everyone seems smarter?',
      voiceover_text: 'Everyone in class looks smarter than you. Are they, really?' },
    { scene_number: 2, name: 'Modern Situation', start_time: 4, end_time: 12, on_screen_text: 'The comparison trap',
      voiceover_text: 'Results are out. You scroll, you compare, and you quietly decide you are behind.' },
    { scene_number: 3, name: 'Authentic Teaching', start_time: 12, end_time: 22,
      on_screen_text: 'Have faith in yourselves, and stand up on that faith and be strong; that is what we need.',
      authentic_quote: 'Have faith in yourselves, and stand up on that faith and be strong; that is what we need.',
      voiceover_text: 'Swami Vivekananda said: "Have faith in yourselves, and stand up on that faith and be strong; that is what we need."' },
    { scene_number: 4, name: 'Micro-Action', start_time: 22, end_time: 27, on_screen_text: 'Write one win',
      voiceover_text: 'Write down one thing you did well this week. Read it before you sleep.' },
    { scene_number: 5, name: 'Outro & Reflection', start_time: 27, end_time: 30, on_screen_text: 'Believe in yourself',
      voiceover_text: 'Share this with a friend who needs it today.' },
  ],
};

// What each layer of a reel is, for the "anatomy" section.
export const LAYERS = [
  { name: 'Hook', tag: 'AI-written', text: 'The first 3 seconds, written for your situation.' },
  { name: 'Your moment', tag: 'AI-written', text: 'A scene from student life today.' },
  { name: 'His words', tag: 'Verbatim · locked', locked: true, text: 'Exact passage from the Complete Works. AI can only pick it, never write it.' },
  { name: 'Try this', tag: 'AI-written', text: 'One small action for today.' },
  { name: 'Source', tag: 'Citation', text: 'Volume and lecture on screen, linked to the original.' },
];
