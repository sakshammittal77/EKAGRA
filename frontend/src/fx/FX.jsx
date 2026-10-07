import { useEffect } from 'react';

// Light motion layer, mounted once: [data-reveal] elements fade up when they scroll
// into view (including ones added after route changes). The state is a data-in attribute,
// not a class, so React re-rendering a card's className can't hide it again. Opacity + transform only,
// so scrolling stays smooth. Skipped when the user prefers reduced motion.

export default function FX() {
  // One shared pointer listener: cards marked [data-spot] get --mx/--my for a soft light that
  // follows the mouse (CSS variables only, so React never re-renders on mouse move).
  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches) return undefined;
    const on = (e) => {
      const el = e.target instanceof Element && e.target.closest('[data-spot]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, []);

  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || !('IntersectionObserver' in window)) {
      const show = () => document.querySelectorAll('[data-reveal]').forEach((el) => el.setAttribute('data-in', ''));
      show();
      const mo = new MutationObserver(show);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.setAttribute('data-in', ''); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    const scan = (root) => root.querySelectorAll?.('[data-reveal]:not([data-in])').forEach((el) => io.observe(el));
    scan(document);
    const mo = new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.matches('[data-reveal]:not([data-in])')) io.observe(n);
      scan(n);
    })));
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}
