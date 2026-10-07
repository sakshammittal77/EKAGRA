import { useCallback, useEffect, useState } from 'react';

// Saves each student's progress in their browser (localStorage).
// Later this can move to the team's backend so it follows them across devices.

const EMPTY = { learned: [], learnedAt: {}, checkins: [] };

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

  // Always update from the latest state (so delayed actions like Undo never use stale data).
  const update = useCallback((fn) => {
    setData((prev) => {
      const next = fn(prev);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage full or blocked */ }
      return next;
    });
  }, [key]);

  const toggleLearned = useCallback((teachingId) => {
    update((prev) => {
      const has = prev.learned.includes(teachingId);
      const learnedAt = { ...(prev.learnedAt || {}) };
      if (has) delete learnedAt[teachingId]; else learnedAt[teachingId] = new Date().toISOString();
      return {
        ...prev,
        learned: has ? prev.learned.filter((id) => id !== teachingId) : [...prev.learned, teachingId],
        learnedAt,
      };
    });
  }, [update]);

  const addCheckin = useCallback((themeId) => {
    update((prev) => ({
      ...prev,
      checkins: [{ themeId, at: new Date().toISOString() }, ...prev.checkins].slice(0, 20),
    }));
  }, [update]);

  return {
    learned: data.learned,
    learnedAt: data.learnedAt || {},
    checkins: data.checkins,
    isLearned: (id) => data.learned.includes(id),
    toggleLearned,
    addCheckin,
  };
}
