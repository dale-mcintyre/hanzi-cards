import { useState, useEffect } from 'react';

export function useStreak() {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = localStorage.getItem('hz_last_active_date');
    const currentStreak = parseInt(localStorage.getItem('hz_streak_count') || '0', 10);

    if (!lastActive) {
      // First time user
      setStreak(0);
      return;
    }

    const lastDate = new Date(lastActive);
    const nowDate = new Date(today);
    const diffTime = Math.abs(nowDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      setStreak(currentStreak || 1);
    } else if (diffDays === 1) {
      setStreak(currentStreak);
    } else {
      // Streak expired
      setStreak(0);
      localStorage.setItem('hz_streak_count', '0');
    }
  }, []);

  const recordActivity = () => {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = localStorage.getItem('hz_last_active_date');
    let currentStreak = parseInt(localStorage.getItem('hz_streak_count') || '0', 10);

    if (lastActive === today) return; // Already recorded today

    const lastDate = lastActive ? new Date(lastActive) : null;
    const nowDate = new Date(today);

    if (lastDate) {
      const diffDays = Math.round((nowDate - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }

    localStorage.setItem('hz_last_active_date', today);
    localStorage.setItem('hz_streak_count', String(currentStreak));
    setStreak(currentStreak);
  };

  return { streak, recordActivity };
}