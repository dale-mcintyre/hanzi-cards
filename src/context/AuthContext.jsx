import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getProgress, hydrateLocalFromRemote, setCurrentSyncUser } from '../utils/storage';
import { pullAllProgress, mergeLocalAndRemoteProgress, pushCardProgress } from '../utils/syncClient';
import { flush as flushSyncQueue } from '../utils/syncQueue';

const AuthContext = createContext(null);

function pushFnFor(userId) {
  return (cardId, stats) => pushCardProgress(userId, cardId, stats);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  // Bumped after a remote->local hydration so App.jsx's loadDeck effect
  // (which otherwise only depends on revisionLevels) knows to re-run and
  // pick up the freshly-merged progress.
  const [syncVersion, setSyncVersion] = useState(0);

  // One-time reconciliation between this device's local progress and the
  // signed-in account's remote progress. Idempotent and safe to call more
  // than once (guarded by a per-account localStorage flag) - see PLAN.md's
  // "Anonymous -> account migration" section for the local-wins-by-default
  // reasoning.
  const runMigration = useCallback(async (user) => {
    const migratedFlag = `hz_synced_account_${user.id}`;
    try {
      if (localStorage.getItem(migratedFlag) === 'true') return;
    } catch (e) {
      // localStorage unavailable - fall through and attempt the merge
      // anyway rather than getting stuck never syncing.
    }

    const local = getProgress();
    const remoteResult = await pullAllProgress(user.id);
    if (!remoteResult.ok) return; // fail-open: try again on the next sign-in

    const { merged, toPush } = mergeLocalAndRemoteProgress(local, remoteResult.data);

    await Promise.all(
      Object.entries(toPush).map(([cardId, stats]) => pushCardProgress(user.id, cardId, stats))
    );
    hydrateLocalFromRemote(merged);
    setSyncVersion((v) => v + 1);

    try {
      localStorage.setItem(migratedFlag, 'true');
    } catch (e) {
      // Non-fatal: worst case the merge (harmlessly) runs again next sign-in.
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsAuthReady(true);
      return;
    }

    let unsubscribed = false;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (unsubscribed) return;
      setSession(initialSession);
      setCurrentSyncUser(initialSession?.user?.id || null);
      setIsAuthReady(true);
      if (initialSession?.user) {
        runMigration(initialSession.user);
        flushSyncQueue(pushFnFor(initialSession.user.id));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setCurrentSyncUser(newSession?.user?.id || null);
      if (event === 'SIGNED_IN' && newSession?.user) {
        runMigration(newSession.user);
        flushSyncQueue(pushFnFor(newSession.user.id));
      }
    });

    return () => {
      unsubscribed = true;
      subscription.unsubscribe();
    };
  }, [runMigration]);

  // Retry queued pushes whenever the device comes back online.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    function handleOnline() {
      flushSyncQueue(pushFnFor(userId));
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session]);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) return { ok: false, error: 'Sync is not configured yet.' };
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || 'Something went wrong.' };
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { ok: false, error: 'Sync is not configured yet.' };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || 'Something went wrong.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }, []);

  const value = {
    user: session?.user || null,
    isAuthReady,
    isSupabaseConfigured: !!supabase,
    syncVersion,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
