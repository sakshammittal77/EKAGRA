import { useEffect, useState } from 'react';

// Tiny hash router: #/home, #/learning, #/teachings/courage, #/reels, #/quiz
function read() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { page: parts[0] || 'home', param: parts[1] || null };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(path) {
  window.location.hash = `#/${path}`;
}
