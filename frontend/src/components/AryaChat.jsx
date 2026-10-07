import { useEffect, useRef, useState } from 'react';
import { assistantChat } from '../lib/api.js';
import { setReelDraft } from '../lib/library.js';
import { go } from '../lib/router.js';

// Arya's chat: the student types or speaks (Hindi or English), our AI answers kindly
// (Gemini, with Groq as backup), and Arya reads the answer aloud.
// Swami Vivekananda's words are never written by the AI: the backend picks a verified
// passage by ID and sends its exact text and source, shown separately below the reply.

const T = {
  en: {
    placeholder: 'Tell Arya how you feel…', thinking: 'Arya is thinking…', listening: 'Listening… speak now',
    his: 'Swami Vivekananda · his exact words', try: 'Try this today:', reel: 'Make a reel about this →',
    hear: 'Hear his words', again: 'Hear Arya again', reset: 'Start over', simple: 'Simple mode: the AI could not answer this time.',
    mic: 'Speak instead of typing', micOff: "Your browser can't listen here. Please type instead.", send: 'Send',
    examples: ["I'm scared of exams", "I can't focus", "I don't believe in myself", 'I feel lonely'],
    note: "Arya is an AI companion, not a counsellor. If you're struggling a lot, please talk to someone you trust.",
    err: 'Arya could not reply right now. Please try again in a minute.',
  },
  hi: {
    placeholder: 'आर्या को बताइए आप कैसा महसूस कर रहे हैं…', thinking: 'आर्या सोच रही है…', listening: 'सुन रही हूँ… अब बोलिए',
    his: 'स्वामी विवेकानंद · उनके मूल शब्द', try: 'आज यह करके देखिए:', reel: 'इस पर रील बनाइए →',
    hear: 'उनके शब्द सुनिए', again: 'आर्या को फिर सुनिए', reset: 'नई बातचीत', simple: 'साधारण मोड: इस बार AI जवाब नहीं दे पाया।',
    mic: 'लिखने की जगह बोलिए', micOff: 'यह ब्राउज़र यहाँ सुन नहीं सकता। कृपया लिखिए।', send: 'भेजें',
    examples: ['मुझे परीक्षा से डर लगता है', 'पढ़ाई में मन नहीं लगता', 'मुझे खुद पर भरोसा नहीं', 'मैं अकेला महसूस करता हूँ'],
    note: 'आर्या एक AI साथी है, काउंसलर नहीं। अगर बहुत मुश्किल लग रहा है, तो किसी भरोसेमंद व्यक्ति से बात कीजिए।',
    err: 'आर्या अभी जवाब नहीं दे पाई। एक मिनट बाद फिर कोशिश कीजिए।',
  },
};

const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const isHindi = (text) => /[ऀ-ॿ]/.test(text || '');

export default function AryaChat({ a, backend, compact = false }) {
  const t = T[a.lang] || T.en;
  const [thread, setThread] = useState([]); // {role:'user', text} | {role:'assistant', ...reply}
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (thread.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [thread, busy]);
  useEffect(() => () => recRef.current?.abort?.(), []);

  async function send(raw) {
    const msg = (raw ?? text).trim();
    if (!msg || busy) return;
    a.stop();
    const next = [...thread, { role: 'user', text: msg }];
    setThread(next); setText(''); setError(''); setBusy(true);
    try {
      if (backend && backend.status !== 'online') await backend.reconnect?.();
      const res = await assistantChat(
        next.slice(-8).map((m) => ({ role: m.role, text: m.role === 'user' ? m.text : m.reply })),
        thread.filter((m) => m.quote).map((m) => m.quote.id),
        a.lang,
      );
      setThread([...next, { role: 'assistant', ...res }]);
      speakReply(res);
    } catch {
      setError(t.err);
      setThread(thread); setText(msg);
    } finally {
      setBusy(false);
    }
  }

  function speakReply(m) {
    const parts = [m.reply, m.action && `${T[isHindi(m.reply) ? 'hi' : 'en'].try} ${m.action}`].filter(Boolean);
    a.say(parts.join(' '), isHindi(m.reply) ? 'hi' : 'en');
  }

  function listen() {
    if (!SpeechRec) { setError(t.micOff); return; }
    if (listening) { recRef.current?.stop(); return; }
    a.stop();
    const rec = new SpeechRec();
    rec.lang = a.lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setText((finalText + interim).trim());
    };
    rec.onerror = (e) => { if (e.error !== 'aborted' && e.error !== 'no-speech') setError(t.micOff); };
    rec.onend = () => { setListening(false); recRef.current = null; if (finalText.trim()) send(finalText); };
    recRef.current = rec;
    setError('');
    setListening(true);
    try { rec.start(); } catch { setListening(false); setError(t.micOff); }
  }

  function makeReel(m) {
    const firstUser = thread.find((x) => x.role === 'user');
    setReelDraft({ situation: firstUser?.text || '', theme: m.theme || undefined, teachingId: m.quote?.id });
    go('reels/new');
  }

  return (
    <div className={`arya-chat${compact ? ' compact' : ''}`}>
      {thread.length > 0 && (
        <div className="ac-thread" aria-live="polite">
          {thread.map((m, i) => (m.role === 'user'
            ? <p key={i} className="ac-user">{m.text}</p>
            : <Reply key={i} m={m} t={t} a={a} onReel={makeReel} onAgain={() => speakReply(m)} />))}
          {busy && <p className="ac-typing"><span className="eq" aria-hidden="true"><i /><i /><i /></span> {t.thinking}</p>}
          <div ref={endRef} />
        </div>
      )}

      <form className="ac-row" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor={compact ? 'arya-ask-dock' : 'arya-ask'}>{t.placeholder}</label>
        <input id={compact ? 'arya-ask-dock' : 'arya-ask'} className="input ac-input" value={text} maxLength={1000}
          lang={a.lang} disabled={busy} placeholder={listening ? t.listening : t.placeholder}
          onChange={(e) => setText(e.target.value)} />
        <button type="button" className={`ac-mic${listening ? ' on' : ''}`} onClick={listen} disabled={busy}
          aria-label={t.mic} title={t.mic} aria-pressed={listening}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" /></svg>
        </button>
        <button type="submit" className="ac-send" disabled={busy || !text.trim()} aria-label={t.send}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </button>
      </form>

      {thread.length === 0 && (
        <div className="ac-chips">
          {t.examples.map((ex) => (
            <button key={ex} type="button" className="ac-chip" lang={a.lang} onClick={() => send(ex)}>{ex}</button>
          ))}
        </div>
      )}
      {thread.length > 0 && !busy && (
        <button type="button" className="ac-reset" onClick={() => { a.stop(); setThread([]); setError(''); }}>{t.reset}</button>
      )}
      {error && <p className="ac-error" role="status">{error}</p>}
      {!compact && <p className="ac-note">{t.note}</p>}
    </div>
  );
}

function Reply({ m, t, a, onReel, onAgain }) {
  if (m.crisis) {
    return (
      <div className="ac-card ac-crisis">
        <p className="ac-reply">{m.reply}</p>
        <ul className="ac-help">
          {(m.helplines || []).map((h) => (
            <li key={h.phone}>
              <strong>{h.name}</strong>
              <a href={`tel:${h.phone}`} className="ac-call">Call {h.phone}</a>
              {h.alt && <span className="ac-alt">or {h.alt}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="ac-card">
      {m.feeling && <span className="ac-feeling">{m.feeling}</span>}
      <p className="ac-reply" lang={isHindi(m.reply) ? 'hi' : 'en'}>{m.reply}</p>
      {m.quote && (
        <figure className="ac-quote">
          <span className="ac-quote-label">{t.his}</span>
          <blockquote>“{m.quote.text}”</blockquote>
          <figcaption><a href={m.quote.url} target="_blank" rel="noreferrer">{m.quote.source} ↗</a></figcaption>
        </figure>
      )}
      {m.action && <p className="ac-action"><strong>{t.try}</strong> {m.action}</p>}
      {m.mode === 'backup' && <p className="ac-mode">{t.simple}</p>}
      <div className="ac-buttons">
        {a.canSpeak && <button type="button" className="ac-btn ghost" onClick={onAgain}>🔊 {t.again}</button>}
        {a.canSpeak && m.quote && (
          <button type="button" className="ac-btn ghost" onClick={() => a.say(m.quote.text, 'en')}>🔊 {t.hear}</button>
        )}
        {m.theme && <button type="button" className="ac-btn" onClick={() => onReel(m)}>{t.reel}</button>}
      </div>
    </div>
  );
}
