import { useEffect, useRef, useState } from 'react';
import { assistantChat, transcribeAudio } from '../lib/api.js';
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
    mic: 'Speak instead of typing', micStop: 'Stop and send', micOff: "Your browser can't record here. Please type instead.",
    micDenied: 'Please allow the microphone (click the lock icon next to the website address), then try again.',
    micFail: "Sorry, I couldn't catch that. Please try again or type.", transcribing: 'Understanding what you said…', send: 'Send',
    examples: ["I'm scared of exams", "I can't focus", "I don't believe in myself", 'I feel lonely'],
    note: "Arya is an AI companion, not a counsellor. If you're struggling a lot, please talk to someone you trust.",
    err: 'Arya could not reply right now. Please try again in a minute.',
  },
  hi: {
    placeholder: 'आर्या को बताइए आप कैसा महसूस कर रहे हैं…', thinking: 'आर्या सोच रही है…', listening: 'सुन रही हूँ… अब बोलिए',
    his: 'स्वामी विवेकानंद · उनके मूल शब्द', try: 'आज यह करके देखिए:', reel: 'इस पर रील बनाइए →',
    hear: 'उनके शब्द सुनिए', again: 'आर्या को फिर सुनिए', reset: 'नई बातचीत', simple: 'साधारण मोड: इस बार AI जवाब नहीं दे पाया।',
    mic: 'लिखने की जगह बोलिए', micStop: 'रोकें और भेजें', micOff: 'यह ब्राउज़र यहाँ रिकॉर्ड नहीं कर सकता। कृपया लिखिए।',
    micDenied: 'कृपया माइक्रोफ़ोन की अनुमति दीजिए (वेबसाइट पते के पास ताले वाले आइकन पर क्लिक करें), फिर दोबारा कोशिश करें।',
    micFail: 'माफ़ कीजिए, मैं समझ नहीं पाई। फिर से बोलिए या लिखिए।', transcribing: 'आपकी बात समझ रही हूँ…', send: 'भेजें',
    examples: ['मुझे परीक्षा से डर लगता है', 'पढ़ाई में मन नहीं लगता', 'मुझे खुद पर भरोसा नहीं', 'मैं अकेला महसूस करता हूँ'],
    note: 'आर्या एक AI साथी है, काउंसलर नहीं। अगर बहुत मुश्किल लग रहा है, तो किसी भरोसेमंद व्यक्ति से बात कीजिए।',
    err: 'आर्या अभी जवाब नहीं दे पाई। एक मिनट बाद फिर कोशिश कीजिए।',
  },
};

// Voice input: record with the microphone and let the backend turn it into text (Whisper on Groq,
// Gemini as backup). Works in every browser, including Brave and Safari.
const canRecord = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined';
const MAX_SECONDS = 30;
function pickMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
  }
  return '';
}
const toBase64 = (blob) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = fail;
  r.readAsDataURL(blob);
});
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
  const rootRef = useRef(null);

  // On Home, the particle globe behind Arya fills the hero stage. Tell it how tall this chat is,
  // so the globe keeps its original size and place instead of stretching as the chat grows.
  useEffect(() => {
    const el = rootRef.current;
    const stage = el?.closest('.hero-stage');
    if (!el || !stage || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const h = el.getBoundingClientRect().height + parseFloat(getComputedStyle(el).marginTop || '0');
      stage.style.setProperty('--arya-chat-h', `${Math.round(h)}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { ro.disconnect(); stage.style.removeProperty('--arya-chat-h'); };
  }, []);

  useEffect(() => {
    if (thread.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [thread, busy]);
  useEffect(() => () => { if (recRef.current?.state === 'recording') recRef.current.stop(); }, []);

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
    // Hindi chosen (or a Hindi reply): Arya's Hindi voice (Swara); otherwise her English voice.
    const voiceLang = a.lang === 'hi' || isHindi(m.reply) ? 'hi' : 'en';
    const parts = [m.reply, m.action && `${T[voiceLang].try} ${m.action}`].filter(Boolean);
    a.say(parts.join(' '), voiceLang);
  }

  const [secs, setSecs] = useState(0);
  const [hearing, setHearing] = useState(false); // waiting for the transcript

  async function listen() {
    if (listening) { recRef.current?.stop(); return; } // stop = send
    if (!canRecord) { setError(t.micOff); return; }
    a.stop();
    setError('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      setError(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? t.micDenied : t.micOff);
      return;
    }
    const mime = pickMime();
    let rec;
    try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); } catch {
      stream.getTracks().forEach((tr) => tr.stop()); setError(t.micOff); return;
    }
    const chunks = [];
    const started = Date.now();
    const tick = setInterval(() => {
      const s2 = Math.floor((Date.now() - started) / 1000);
      setSecs(s2);
      if (s2 >= MAX_SECONDS && rec.state === 'recording') rec.stop();
    }, 250);
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    rec.onstop = async () => {
      clearInterval(tick);
      stream.getTracks().forEach((tr) => tr.stop());
      setListening(false); setSecs(0); recRef.current = null;
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      if (Date.now() - started < 700 || blob.size < 800) return; // tapped by accident
      setHearing(true);
      try {
        const res = await transcribeAudio(await toBase64(blob), blob.type, a.lang);
        const said = (res.text || '').trim();
        if (said) send(said); else setError(t.micFail);
      } catch {
        setError(t.micFail);
      } finally {
        setHearing(false);
      }
    };
    recRef.current = rec;
    rec.start(250);
    setListening(true);
  }

  function makeReel(m) {
    const firstUser = thread.find((x) => x.role === 'user');
    setReelDraft({ situation: firstUser?.text || '', theme: m.theme || undefined, teachingId: m.quote?.id });
    go('reels/new');
  }

  return (
    <div ref={rootRef} className={`arya-chat${compact ? ' compact' : ''}`}>
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
          lang={a.lang} disabled={busy || hearing} placeholder={listening ? `${t.listening} ${secs}s` : hearing ? t.transcribing : t.placeholder}
          onChange={(e) => setText(e.target.value)} />
        <button type="button" className={`ac-mic${listening ? ' on' : ''}${hearing ? ' wait' : ''}`} onClick={listen} disabled={busy || hearing}
          aria-label={listening ? t.micStop : t.mic} title={listening ? t.micStop : t.mic} aria-pressed={listening}>
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
