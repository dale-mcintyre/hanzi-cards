import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { queueSize } from '../utils/syncQueue';

const POLL_INTERVAL_MS = 4000;

export default function SyncStatusDot() {
  const { user, isSupabaseConfigured } = useAuth();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;

    function tick() {
      setPending(queueSize());
    }
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);

    function handleOnline() { setIsOnline(true); tick(); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSupabaseConfigured, user]);

  if (!isSupabaseConfigured || !user) return null;

  const isSynced = isOnline && pending === 0;
  const title = !isOnline
    ? 'Offline - changes saved locally'
    : pending > 0
      ? `${pending} card${pending === 1 ? '' : 's'} pending sync`
      : 'Synced';

  return (
    <span
      className={`sync-status-dot sync-status-dot--${isSynced ? 'synced' : 'pending'}`}
      title={title}
      aria-label={title}
    />
  );
}
