import { useEffect, useRef, useState } from 'react';
import { canSpeak, preload, speak, stopSpeaking } from '../lib/voice.js';

// Arya, the talking guide: an illustrated narrator who explains each page out loud
// (the browser's own voice), with blinking, cursor-following eyes and a moving mouth.
// She is deliberately not Swami Vivekananda: he is never given AI-written lines.
//  - <GuideHero/>  large "talking hero" on the home page
//  - <GuideDock/>  small button on other pages; opens only when clicked

const LINES = {
  home: {
    en: "Hi, I'm Arya. Pick a verified teaching of Swami Vivekananda, tell me what you're going through, and I'll help you turn it into a 30 to 60 second reel. His words stay exactly as he said them, with the source on screen.",
    hi: 'नमस्ते, मैं आर्या हूँ। स्वामी विवेकानंद की कोई प्रमाणित शिक्षा चुनिए, अपनी बात बताइए, और मैं उसे 30 से 60 सेकंड की रील बनाने में मदद करूँगी। उनके शब्द बिल्कुल वैसे ही रहते हैं, स्रोत के साथ।',
  },
  new: {
    en: 'Choose a theme, describe a real moment, and pick a matching passage or let me choose. Then you can edit everything except his words.',
    hi: 'एक थीम चुनिए, कोई असली पल लिखिए, और मिलता हुआ अंश चुनिए। उनके शब्दों के अलावा सब कुछ बदल सकते हैं।',
  },
  reels: {
    en: 'Your saved reels. Open one to play it, export a video or delete it.',
    hi: 'आपकी सेव की हुई रील्स। चलाने, वीडियो बनाने या हटाने के लिए खोलिए।',
  },
  teachings: {
    en: 'The verified library. Every passage links to its source page, so anyone can check it.',
    hi: 'प्रमाणित संग्रह। हर अंश अपने मूल पेज से जुड़ा है, ताकि कोई भी जाँच सके।',
  },
  factcheck: {
    en: "Paste a quote you saw online and I'll check it against the verified passages.",
    hi: 'ऑनलाइन देखा कोई उद्धरण पेस्ट कीजिए, मैं उसे प्रमाणित अंशों से मिलाऊँगी।',
  },
  history: {
    en: 'Everything you have marked as learned, newest first. Unmark any passage to send it back to its theme.',
    hi: 'जो कुछ आपने सीखा है, सबसे नया पहले। किसी अंश को हटाने पर वह अपनी थीम में वापस चला जाता है।',
  },
  learning: {
    en: 'Your progress: reels made, passages learned and check-ins.',
    hi: 'आपकी प्रगति: बनी रील्स, सीखे अंश और चेक-इन।',
  },
  quiz: {
    en: 'Answer honestly. There are no wrong answers.',
    hi: 'ईमानदारी से जवाब दीजिए। कोई जवाब गलत नहीं है।',
  },
};

export function guideKey(page, param) {
  if (page === 'reels') return param === 'new' ? 'new' : 'reels';
  return LINES[page] ? page : 'home';
}

const SPEEDS = [1, 1.25, 1.5];

function useArya(key) {
  const [lang, setLang] = useState('en');
  const [speaking, setSpeaking] = useState(false);
  const [mouth, setMouth] = useState(0);
  const [at, setAt] = useState(-1); // character index of the word being spoken
  const [speed, setSpeed] = useState(() => { try { return Number(localStorage.getItem('ekagra-arya-speed')) || 1.25; } catch { return 1.25; } });
  const stopRef = useRef(null);
  const line = LINES[key][lang];

  useEffect(() => () => { if (stopRef.current) stopSpeaking(); }, [key]);
  // fetch Arya's natural voice for this line in advance, so it starts the moment you press play
  useEffect(() => { preload([line], lang); }, [line, lang]);
  useEffect(() => {
    if (!speaking) { setMouth(0); return undefined; }
    const id = setInterval(() => setMouth((m) => Math.max(0.15, m * 0.6)), 70); // mouth closes between words
    return () => clearInterval(id);
  }, [speaking]);

  function talk(rate = speed) {
    if (speaking) { stopRef.current?.stop(); return; }
    stopRef.current = speak(line, {
      lang, rate,
      onStart: () => setSpeaking(true),
      onEnd: () => { setSpeaking(false); setAt(-1); stopRef.current = null; },
      onWord: (i) => { setAt(i); setMouth(1); },
    });
    setSpeaking(true);
  }

  function changeSpeed(v) {
    setSpeed(v);
    try { localStorage.setItem('ekagra-arya-speed', String(v)); } catch { /* blocked */ }
    stopRef.current?.setRate(v); // changes speed mid-sentence, no restart
  }

  function switchLang(l) { stopRef.current?.stop(); setLang(l); }
  return { lang, switchLang, line, talk: () => talk(), speaking, mouth, at, speed, changeSpeed, canSpeak: canSpeak() };
}

// The line, with the word being spoken highlighted (karaoke style).
function Spoken({ a }) {
  if (a.at < 0) return <p lang={a.lang}>{a.line}</p>;
  const parts = a.line.split(/(\s+)/);
  let pos = 0;
  return (
    <p lang={a.lang} className="spoken">
      {parts.map((w, i) => {
        const start = pos;
        pos += w.length;
        if (/^\s+$/.test(w)) return w;
        const state = start + w.length <= a.at ? 'said' : start <= a.at ? 'now' : '';
        return <span key={i} className={state}>{w}</span>;
      })}
    </p>
  );
}

export function AryaFigure({ speaking, mouth, className }) {
  const [blink, setBlink] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  useEffect(() => {
    let t;
    const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 130); loop(); }, 2400 + Math.random() * 2600); };
    loop();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let raf = 0;
    const on = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (r.top + r.height / 3)) / window.innerHeight;
        setLook({ x: Math.max(-1, Math.min(1, dx * 2.5)), y: Math.max(-1, Math.min(1, dy * 2.5)) });
      });
    };
    window.addEventListener('mousemove', on, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', on); };
  }, []);

  const eye = { x: look.x * 3, y: look.y * 2.5 };
  const head = `rotate(${look.x * 4} 100 150) translate(${look.x * 2} ${look.y * 1.5})`;
  const brow = speaking ? 2 : 0;

  return (
    <svg ref={ref} className={className} viewBox="0 0 200 250" aria-hidden="true">
      <defs>
        <linearGradient id="ar-hoodie" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8732a" />
          <stop offset="1" stopColor="#b84a0e" />
        </linearGradient>
        <linearGradient id="ar-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c98b62" />
          <stop offset="1" stopColor="#a96d48" />
        </linearGradient>
      </defs>
      <path d="M28 250 C30 200 60 180 100 180 C140 180 170 200 172 250 Z" fill="url(#ar-hoodie)" />
      <path d="M74 186 C84 204 116 204 126 186" fill="none" stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" />
      <path d="M84 196 L80 232 M116 196 L120 232" stroke="#fff3e6" strokeWidth="2.5" strokeLinecap="round" />
      <text x="100" y="236" textAnchor="middle" fontSize="13" fill="#fff3e6" fontFamily="Rozha One, serif">एकाग्र</text>
      <path d="M88 158 L88 184 Q100 192 112 184 L112 158 Z" fill="#a96d48" />
      <g transform={head}>
        <path d="M54 104 C50 60 78 38 104 40 C134 42 154 66 148 108 C150 132 146 150 140 160 L60 160 C54 146 52 128 54 104 Z" fill="#17111c" />
        <ellipse cx="100" cy="112" rx="40" ry="47" fill="url(#ar-skin)" />
        <ellipse cx="60" cy="114" rx="6" ry="9" fill="#b07350" />
        <ellipse cx="140" cy="114" rx="6" ry="9" fill="#b07350" />
        <circle cx="60" cy="127" r="2.6" fill="#d9a441" />
        <circle cx="140" cy="127" r="2.6" fill="#d9a441" />
        <path d="M58 98 C64 62 96 52 120 60 C136 66 146 82 144 100 C132 84 112 76 92 80 C78 82 66 90 58 98 Z" fill="#241a2b" />
        <circle cx="100" cy="88" r="2.4" fill="#c81e3a" />
        <path d={`M78 ${96 - brow} Q86 ${92 - brow} 94 96`} stroke="#17111c" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d={`M106 96 Q114 ${92 - brow} 122 ${96 - brow}`} stroke="#17111c" strokeWidth="3" fill="none" strokeLinecap="round" />
        <g style={{ transform: blink ? 'scaleY(0.1)' : 'none', transformOrigin: '100px 108px', transition: 'transform 0.08s' }}>
          <ellipse cx="86" cy="108" rx="7" ry="8" fill="#fff" />
          <ellipse cx="114" cy="108" rx="7" ry="8" fill="#fff" />
          <circle cx={86 + eye.x} cy={109 + eye.y} r="4.2" fill="#2a1a12" />
          <circle cx={114 + eye.x} cy={109 + eye.y} r="4.2" fill="#2a1a12" />
          <circle cx={87.5 + eye.x} cy={107.5 + eye.y} r="1.3" fill="#fff" />
          <circle cx={115.5 + eye.x} cy={107.5 + eye.y} r="1.3" fill="#fff" />
        </g>
        <path d="M100 114 Q97 124 101 127" stroke="#8a5536" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="78" cy="128" rx="7" ry="4" fill="#e07a6a" opacity="0.35" />
        <ellipse cx="122" cy="128" rx="7" ry="4" fill="#e07a6a" opacity="0.35" />
        {speaking ? (
          <g>
            <ellipse cx="100" cy="140" rx={7 + mouth * 2} ry={1.5 + mouth * 6} fill="#5b1a1a" />
            <ellipse cx="100" cy={141 + mouth * 3} rx="4" ry={mouth * 2.2} fill="#e35d6a" />
          </g>
        ) : (
          <path d="M88 138 Q100 148 112 138" stroke="#5b1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}

function LangSwitch({ lang, onChange }) {
  return (
    <span className="lang-switch">
      {['en', 'hi'].map((l) => (
        <button key={l} type="button" className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => onChange(l)}>
          {l === 'en' ? 'EN' : 'हि'}
        </button>
      ))}
    </span>
  );
}

function SpeakButton({ a }) {
  if (!a.canSpeak) return null;
  return (
    <div className="speak-row">
    <button type="button" className={`speak-btn${a.speaking ? ' on' : ''}`} onClick={a.talk}>
      {a.speaking
        ? <><span className="eq" aria-hidden="true"><i /><i /><i /></span> Stop</>
        : <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7 4 20 12 7 20" /></svg> Hear Arya</>}
    </button>
    <span className="speed-switch" role="group" aria-label="Speaking speed">
      {SPEEDS.map((v) => (
        <button key={v} type="button" className={a.speed === v ? 'on' : ''} aria-pressed={a.speed === v} onClick={() => a.changeSpeed(v)}>{v}×</button>
      ))}
    </span>
    </div>
  );
}

// Home page: Arya stands in the hero and introduces EKAGRA.
export function GuideHero() {
  const a = useArya('home');
  return (
    <div className={`arya-hero${a.speaking ? ' speaking' : ''}`}>
      <button type="button" className="arya-hero-figure" onClick={a.talk} aria-label="Hear Arya explain EKAGRA">
        <AryaFigure speaking={a.speaking} mouth={a.mouth} />
      </button>
      <div className="arya-card">
        <div className="arya-card-top">
          <span className="arya-name">Arya <small>your guide</small></span>
          <LangSwitch lang={a.lang} onChange={a.switchLang} />
        </div>
        <Spoken a={a} />
        <SpeakButton a={a} />
      </div>
    </div>
  );
}

// Other pages: a small button. The card opens only on click and closes on Esc or outside click.
export function GuideDock({ page, param }) {
  const key = guideKey(page, param);
  const a = useArya(key);
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => { setOpen(false); }, [key]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (e.key === 'Escape' || (e.type === 'pointerdown' && !root.current?.contains(e.target))) setOpen(false); };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', close); };
  }, [open]);

  return (
    <aside ref={root} className={`dock${open ? ' open' : ''}${a.speaking ? ' speaking' : ''}`}>
      {open && (
        <div className="dock-card" role="dialog" aria-label="Arya explains this page">
          <div className="arya-card-top">
            <span className="arya-name">Arya <small>your guide</small></span>
            <LangSwitch lang={a.lang} onChange={a.switchLang} />
          </div>
          <Spoken a={a} />
          <SpeakButton a={a} />
        </div>
      )}
      <button type="button" className="dock-btn" onClick={() => setOpen(!open)} aria-expanded={open}
        aria-label={open ? 'Close guide' : 'Ask Arya about this page'}>
        <AryaFigure speaking={a.speaking} mouth={a.mouth} />
      </button>
    </aside>
  );
}
