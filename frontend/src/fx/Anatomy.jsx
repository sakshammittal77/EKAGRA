import { useCallback, useEffect, useRef, useState } from 'react';
import ReelPlayer from '../components/ReelPlayer.jsx';
import { LAYERS, SAMPLE_REEL } from '../lib/sampleReel.js';

// "Anatomy of a reel": the five layers of a reel as a 3D stack, next to a sample reel
// that plays on loop. The layer being shown lights up; clicking a layer jumps to it.

export default function Anatomy() {
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const wrap = useRef(null);
  const control = useRef(null);
  const onScene = useCallback((i) => setActive(i), []);

  useEffect(() => {
    const io = new IntersectionObserver(([en]) => setInView(en.isIntersecting), { threshold: 0.25 });
    io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  const L = LAYERS[active];

  return (
    <section className="anatomy" ref={wrap} data-nav-dark>
      <div className="anatomy-inner">
        <div className="anatomy-copy" data-reveal>
          <span className="eyebrow">Anatomy of a reel</span>
          <h2 className="h2">Five layers. Only one is his,<br />and it's never rewritten.</h2>

          <div className={`stack${inView ? ' open' : ''}`}>
            <div className="stack-iso">
              {LAYERS.map((l, i) => (
                <button key={l.name} type="button"
                  className={`plate${i === active ? ' on' : ''}${l.locked ? ' locked' : ''}`}
                  style={{ '--z': `${(LAYERS.length - 1 - i)}` }}
                  onClick={() => control.current?.seekScene(i)}
                  aria-label={`Show the ${l.name} layer`}>
                  <span className="plate-num">0{i + 1}</span>
                  <span className="plate-name">{l.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="layer-caption" key={L.name}>
            <span className={`tag${L.locked ? ' tag-saffron' : ''}`}>{L.tag}</span>
            <strong>{L.name}</strong>
            <span>{L.text}</span>
          </div>
        </div>

        <div className="anatomy-player" data-reveal>
          <ReelPlayer reel={SAMPLE_REEL} autoPlay loop compact voiceDefault={false} onScene={onScene} controlRef={control} paused={!inView} />
          <span className="sample-note">Sample reel · plays on loop</span>
        </div>
      </div>
    </section>
  );
}
