import { useCallback, useEffect, useRef, useState } from 'react';

// Small bottom toast with an optional action (e.g. Undo). Disappears after a few seconds.
export function useToast() {
  const [toast, setToast] = useState(null); // { text, action, onAction, link, href }
  const timer = useRef(0);
  const show = useCallback((t) => {
    clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = toast && (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.text}</span>
      {toast.href && <a href={toast.href}>{toast.link}</a>}
      {toast.onAction && <button type="button" onClick={() => { toast.onAction(); setToast(null); }}>{toast.action}</button>}
    </div>
  );
  return [node, show];
}
