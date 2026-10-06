import { useCallback, useEffect, useState } from 'react';

// Saves each student's progress in their browser (localStorage).
// Later this can move to the team's backend so it follows them across devices.

const EMPTY = { learned: [], checkins: [] };

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function useProgress(userId) {
  const key = `ekagra-progress-${userId || 'guest'}`;
  const [data, setData] = useState(() => load(key));

  useEffect(() => { setData(load(key)); }, [key]);

  const save = useCallback((next) => {
    setData(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage full or blocked */ }
  }, [key]);

  const toggleLearned = useCallback((teachingId) => {
    const has = data.learned.includes(teachingId);
    save({
      ...data,
      learned: has ? data.learned.filter((id) => id !== teachingId) : [...data.learned, teachingId],
    });
  }, [data, save]);

  const addCheckin = useCallback((themeId) => {
    save({
      ...data,
      checkins: [{ themeId, at: new Date().toISOString() }, ...data.checkins].slice(0, 20),
    });
  }, [data, save]);

  return {
    learned: data.learned,
    checkins: data.checkins,
    isLearned: (id) => data.learned.includes(id),
    toggleLearned,
    addCheckin,
  };
}
