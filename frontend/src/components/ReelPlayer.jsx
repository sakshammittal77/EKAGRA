import { useEffect, useMemo, useRef, useState } from 'react';
import { W, H, FONT_FACES, buildTimeline, drawFrame, sceneAt } from '../lib/reelRender.js';
import { startAmbient, stopAmbient, blip, audioStream, audioContext } from '../lib/ambient.js';
import { speak, stopSpeaking, narrationLengths, canSpeak } from '../lib/voice.js';

// 9:16 reel preview drawn on a canvas, with scrubbing, scene jumps, natural narration
// (neural voice from the backend), an ambient soundtrack, and WebM export that records
// the picture, the narration and the music together.

const SCALE = 2 / 3; // 720 x 1280 internal resolution

function fmt(t) {
  const s = Math.max(0, Math.floor(t));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function ReelPlayer({ reel, autoPlay = false, onRecorded, loop = false, compact = false, onScene, controlRef, paused, voiceDefault = true }) {
  const canvas = useRef(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [voice, setVoice] = useState(voiceDefault && canSpeak());
  const [narr, setNarr] = useState(null); // seconds of narration per scene, once fetched
  const tl = useMemo(() => buildTimeline(reel, voice ? narr : null), [reel, voice, narr]);
  const [ambient, setAmbient] = useState(false);
  const [rec, setRec] = useState(null); // null | { recorder, chunks }
  const [fontsReady, setFontsReady] = useState(false);
  const state = useRef({ t: 0, playing: autoPlay, scene: -1 });
  const hasVoice = canSpeak();

  useEffect(() => {
    Promise.all(FONT_FACES.map((f) => document.fonts.load(f, 'Aaअআஅ'))).catch(() => {}).finally(() => setFontsReady(true));
  }, []);

  // reset when a different reel is loaded, and fetch its narration ahead of time
  useEffect(() => { state.current.t = 0; state.current.scene = -1; setT(0); }, [reel]); // not on timing updates

  // When scene timings change (narration lengths arrived), keep the same scene and progress.
  const prevTl = useRef(tl);
  useEffect(() => {
    const prev = prevTl.current;
    prevTl.current = tl;
    if (prev === tl || prev.scenes.length !== tl.scenes.length) return;
    const st = state.current;
    const i = sceneAt(prev, st.t);
    const a = prev.scenes[i], b = tl.scenes[i];
    if (!a || !b) return;
    const frac = Math.min(1, Math.max(0, (st.t - a.start) / Math.max(0.01, a.end - a.start)));
    st.t = b.start + frac * (b.end - b.start);
    setT(st.t);
  }, [tl]);
  useEffect(() => {
    let on = true;
    setNarr(null);
    if (voice) {
      narrationLengths((reel.scenes || []).map((s) => s.voiceover_text), reel.language)
        .then((lens) => { if (on && lens.some(Boolean)) setNarr(lens); });
    }
    return () => { on = false; };
  }, [reel, voice]);

  // pause while off-screen (e.g. the home page sample), resume when back
  useEffect(() => { if (paused !== undefined) setPlaying(!paused); }, [paused]);

  useEffect(() => { state.current.playing = playing; if (!playing) stopSpeaking(); }, [playing]);

  // render loop
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    let raf = 0;
    let last = performance.now();
    let lastDrawn = -1;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const st = state.current;
      if (st.playing) {
        st.t += dt;
        if (st.t >= tl.total) {
          if (rec) { st.t = tl.total - 0.001; rec.recorder.state === 'recording' && rec.recorder.stop(); }
          else if (loop) { st.t = 0; st.scene = -1; }
          else { st.t = tl.total; setPlaying(false); }
        }
        setT(st.t);
        const si = sceneAt(tl, st.t);
        if (si !== st.scene) {
          st.scene = si;
          onScene?.(si);
          blip();
          if (voice) narrate(tl.scenes[si]);
        }
      }
      if (st.playing || lastDrawn !== st.t) {
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        drawFrame(ctx, tl, Math.min(st.t, tl.total - 0.001));
        lastDrawn = st.t;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tl, voice, rec, fontsReady, reel.language, loop, onScene]);

  useEffect(() => () => { stopSpeaking(); stopAmbient(); }, []);

  // Narrate a scene, sped up if needed so it fits the scene's length.
  function narrate(scene) {
    const text = scene?.voiceover_text;
    if (!text) return;
    const dur = Math.max(1.5, (scene.end || 0) - Math.max(scene.start || 0, state.current.t) - 0.2);
    speak(text, { lang: reel.language, fit: dur });
  }

  function toggleVoice() {
    const on = !voice;
    setVoice(on);
    stopSpeaking();
    if (on && state.current.playing) narrate(tl.scenes[sceneAt(tl, state.current.t)]);
  }

  function seek(time) {
    state.current.t = Math.min(Math.max(0, time), tl.total - 0.001);
    state.current.scene = -1;
    setT(state.current.t);
  }

  if (controlRef) controlRef.current = { seekScene: (i) => { seek(tl.scenes[i]?.start || 0); if (!state.current.playing) setPlaying(true); } };

  function toggle() {
    if (rec) return;
    if (!playing && state.current.t >= tl.total - 0.05) seek(0);
    state.current.scene = -1;
    setPlaying((p) => !p);
  }

  function toggleAmbient() {
    if (ambient) stopAmbient(); else startAmbient();
    setAmbient(!ambient);
  }

  function exportVideo() {
    const cv = canvas.current;
    if (!cv.captureStream || !window.MediaRecorder) {
      alert('Video export needs a recent Chrome, Edge or Firefox.');
      return;
    }
    const stream = cv.captureStream(30);
    audioContext().resume();
    audioStream().getAudioTracks().forEach((tr) => stream.addTrack(tr)); // narration + music
    const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ekagra-reel-${reel._id || 'draft'}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setRec(null);
      setPlaying(false);
      onRecorded?.(blob);
    };
    seek(0);
    recorder.start(250);
    setRec({ recorder, chunks });
    setPlaying(true);
  }

  const si = sceneAt(tl, t);

  return (
    <div className={`player${playing ? ' is-playing' : ''}${rec ? ' is-rec' : ''}`}>
      <div className="player-frame">
        <canvas ref={canvas} width={W * SCALE} height={H * SCALE} onClick={toggle} />
        <div className="player-segs">
          {tl.scenes.map((s, i) => (
            <button key={s.scene_number} type="button" title={s.name} aria-label={`Jump to ${s.name}`}
              onClick={() => seek(s.start)} disabled={!!rec} />
          ))}
        </div>
        {!playing && !rec && (
          <button type="button" className="player-big" onClick={toggle} aria-label="Play">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4" /></svg>
          </button>
        )}
        {compact && hasVoice && (
          <button type="button" className={`player-sound${voice ? ' on' : ''}`} onClick={toggleVoice} aria-label={voice ? 'Mute narration' : 'Play narration'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              {voice ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></> : <><line x1="16" y1="9" x2="22" y2="15" /><line x1="22" y1="9" x2="16" y2="15" /></>}
            </svg>
          </button>
        )}
        {rec && <div className="player-rec"><i /> REC {fmt(t)} / {fmt(tl.total)} · keep this tab open</div>}
      </div>

      <div className="player-bar">
        <button type="button" className="icon-btn" onClick={toggle} disabled={!!rec} aria-label={playing ? 'Pause' : 'Play'}>
          {playing
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4" /></svg>}
        </button>
        <input type="range" className="scrub" min={0} max={tl.total} step={0.05} value={t} disabled={!!rec}
          onChange={(e) => seek(Number(e.target.value))} aria-label="Scrub"
          style={{ '--p': `${(t / tl.total) * 100}%` }} />
        <span className="mono time">{fmt(t)}/{fmt(tl.total)}</span>
      </div>

      {!compact && (
        <div className="player-panel">
          <div className="switch" role="group" aria-label="Sound">
            {hasVoice && (
              <button type="button" className={voice ? 'on' : ''} onClick={toggleVoice} aria-pressed={voice}
                title={voice && !narr ? 'Preparing the natural voice…' : 'Narration (also recorded into the download)'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                  {voice ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></> : <><line x1="16" y1="9" x2="22" y2="15" /><line x1="22" y1="9" x2="16" y2="15" /></>}
                </svg>
                <span className="lbl">Voice</span>
                {voice && !narr && <i className="dot-loading" aria-hidden="true" />}
              </button>
            )}
            <button type="button" className={ambient ? 'on' : ''} onClick={toggleAmbient} aria-pressed={ambient}
              title="Soft background music (also recorded into the download)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
              <span className="lbl">Music</span>
            </button>
          </div>
          <button type="button" className="export-btn" onClick={exportVideo} disabled={!!rec}
            title={`Download as a .webm video${voice ? ' with narration' : ''}${ambient ? ' and music' : ''}`}>
            {rec
              ? <><i className="rec-dot" aria-hidden="true" /><span>{fmt(t)} / {fmt(tl.total)}</span></>
              : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><path d="M5 21h14" /></svg><span>Download</span></>}
          </button>
        </div>
      )}
    </div>
  );
}
