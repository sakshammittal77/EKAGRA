import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// "Ekagra" = one-pointed mind. Scattered particles (a distracted mind) gather into a calm,
// slowly turning orb with a ring. The pointer gently pushes them; a click scatters them and
// they gather again. Light on purpose: ~3k points, paused when off-screen.

const VERT = /* glsl */ `
uniform float uTime, uFocus, uSize, uPR, uPush, uScale;
uniform vec2 uMouse, uOffset;
attribute vec3 aOrb;
attribute float aRand;
varying float vRand;
void main() {
  vec3 p = mix(position, aOrb * uScale, uFocus);
  float a = uTime * 0.12;
  float c = cos(a), s = sin(a);
  p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
  p += (1.0 - uFocus) * 0.4 * vec3(sin(uTime + aRand * 30.0), cos(uTime * 0.8 + aRand * 20.0), 0.0);
  p.xy += uOffset;
  vec2 d = p.xy - uMouse;
  float dist = length(d);
  p.xy += (d / max(dist, 0.001)) * uPush * smoothstep(1.8, 0.0, dist) * 0.7;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (0.6 + aRand * 0.8) * (12.0 / -mv.z);
  vRand = aRand;
}`;

const FRAG = /* glsl */ `
uniform float uTime;
varying float vRand;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  vec3 saffron = vec3(0.92, 0.42, 0.12);
  vec3 gold = vec3(0.86, 0.66, 0.28);
  vec3 cream = vec3(1.0, 0.95, 0.86);
  vec3 col = vRand < 0.45 ? saffron : (vRand < 0.8 ? gold : cream);
  float tw = 0.7 + 0.3 * sin(uTime * 1.6 + vRand * 50.0);
  gl_FragColor = vec4(col, a * tw * 0.8);
}`;

// size: share of the space the orb may fill; offset: [x, y] shift as a share of the half-width/height.
export default function Hero3D({ className = 'hero-canvas', size = 0.9, offset = [0, 0] }) {
  const mount = useRef(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return undefined;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const N = window.innerWidth < 760 ? 1800 : 3200;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
    } catch {
      return undefined; // no WebGL: the page works without the particles
    }
    const pr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 13);

    const scatter = new Float32Array(N * 3);
    const orb = new Float32Array(N * 3);
    const rand = new Float32Array(N);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i += 1) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), r = 6 + Math.random() * 8;
      scatter.set([r * Math.sin(ph) * Math.cos(th) * 1.3, r * Math.sin(ph) * Math.sin(th) * 0.8, r * Math.cos(ph) - 3], i * 3);
      if (i % 4 === 0) {
        const a = Math.random() * Math.PI * 2, rr = 4.6 + (Math.random() - 0.5) * 0.2;
        orb.set([Math.cos(a) * rr, Math.sin(a) * rr * 0.22, Math.sin(a) * rr], i * 3);
      } else {
        const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), t = golden * i, R = 3;
        orb.set([Math.cos(t) * rad * R, y * R, Math.sin(t) * rad * R], i * 3);
      }
      rand[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(scatter, 3));
    geo.setAttribute('aOrb', new THREE.BufferAttribute(orb, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

    const uniforms = {
      uTime: { value: 0 }, uFocus: { value: calm ? 1 : 0 }, uSize: { value: 2.4 }, uPR: { value: pr },
      uMouse: { value: new THREE.Vector2(99, 99) }, uPush: { value: 0 },
      uScale: { value: 1 }, uOffset: { value: new THREE.Vector2(0, 0) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(geo, mat));

    let viewW = 10, viewH = 10;
    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      viewH = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      viewW = viewH * camera.aspect;
      // fit the orb (ring radius ~4.7, sphere ~3.1) inside the canvas so it is never clipped
      uniforms.uScale.value = Math.min((viewW / 2) * size / 4.8, (viewH / 2) * size / 3.2, 1.25);
      uniforms.uOffset.value.set(offset[0] * viewW / 2, offset[1] * viewH / 2);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let target = 1, inside = 0;
    const mouse = new THREE.Vector2(99, 99);
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      inside = Math.abs(nx) < 1 && Math.abs(ny) < 1 ? 1 : 0;
      mouse.set((nx * viewW) / 2, (ny * viewH) / 2);
    };
    const onDown = (e) => {
      if (e.target.closest('a, button, input, textarea')) return;
      target = 0;
      setTimeout(() => { target = 1; }, 700);
    };
    el.parentElement?.addEventListener('pointermove', onMove, { passive: true });
    el.parentElement?.addEventListener('pointerdown', onDown);

    let visible = true;
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; });
    io.observe(el);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) { clock.getDelta(); return; }
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!calm) uniforms.uTime.value += dt;
      uniforms.uFocus.value += (target - uniforms.uFocus.value) * (target ? 1.2 : 5) * dt;
      uniforms.uPush.value += (inside - uniforms.uPush.value) * 0.08;
      uniforms.uMouse.value.lerp(mouse, 0.2);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.parentElement?.removeEventListener('pointermove', onMove);
      el.parentElement?.removeEventListener('pointerdown', onDown);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [size, offset[0], offset[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mount} className={className} aria-hidden="true" />;
}
