import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getProgress, hydrateLocalFromRemote, setCurrentSyncUser, getPrefs, hydratePrefsFromRemote } from '../utils/storage';
import { pullAllProgress, mergeLocalAndRemoteProgress, pushCardProgress, pullSettings, pushSettings } from '../utils/syncClient';
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

  // One-time re-keying of this account's remote card_progress rows from
  // the old position-based ID (vocab_<index>_<char>) to the stable
  // character-based one storage.js's local migration already moved to.
  // MUST complete before runMigration below - otherwise
  // mergeLocalAndRemoteProgress would compare fresh local character-keys
  // against still-old-format remote keys, see no overlap, and
  // hydrateLocalFromRemote would write the stale keys straight back into
  // localStorage, undoing the local migration. See the call sites below.
  const runCardIdMigration = useCallback(async (user) => {
    const migratedFlag = `hz_card_id_migrated_account_${user.id}`;
    try {
      if (localStorage.getItem(migratedFlag) === 'true') return;
    } catch (e) {
      // fall through and attempt anyway rather than getting stuck
    }

    const remoteResult = await pullAllProgress(user.id);
    if (!remoteResult.ok) return; // fail-open: retry on next sign-in

    const oldCardIdPattern = /^vocab_\d+_(.+)$/;
    const rewrites = [];
    for (const [cardId, stats] of Object.entries(remoteResult.data)) {
      const match = cardId.match(oldCardIdPattern);
      if (match) rewrites.push({ newCardId: match[1], stats });
    }

    if (rewrites.length > 0) {
      await Promise.all(
        rewrites.map(({ newCardId, stats }) => {
          // An old-format row may collide with an already character-keyed
          // row for the same word (pushed post-migration from another
          // device) - newer lastReviewed wins, same rule mergeLocalAndRemoteProgress uses.
          const existing = remoteResult.data[newCardId];
          const winner = existing && (existing.lastReviewed || 0) > (stats.lastReviewed || 0) ? existing : stats;
          return pushCardProgress(user.id, newCardId, winner);
        })
      );
      // No client-side delete policy on card_progress - the old
      // vocab_N_char rows are left behind as harmless orphans.
    }

    try {
      localStorage.setItem(migratedFlag, 'true');
    } catch (e) {
      // Non-fatal: worst case this (harmlessly) re-runs next sign-in.
    }
  }, []);

  // Reconciliation between this device's local progress and the signed-in
  // account's remote progress. Runs on every app load/sign-in, not just the
  // first time on a device - progress made on other devices only ever
  // reaches this one through this pull, since saveCardProgress's live push
  // is one-directional (device -> remote). Without re-running this every
  // load, two devices on the same account silently drift apart: each one's
  // seen/learning/mastered counts (getCardMasteryStats/getTierStats) read
  // straight off the local cache, which would otherwise be frozen at
  // whatever it looked like the one time this ran. Idempotent either way -
  // see PLAN.md's "Anonymous -> account migration" section for the
  // local-wins-on-conflict reasoning mergeLocalAndRemoteProgress applies.
  const runMigration = useCallback(async (user) => {
    const local = getProgress();
    const remoteResult = await pullAllProgress(user.id);
    if (!remoteResult.ok) return; // fail-open: try again on the next load

    const { merged, toPush } = mergeLocalAndRemoteProgress(local, remoteResult.data);

    await Promise.all(
      Object.entries(toPush).map(([cardId, stats]) => pushCardProgress(user.id, cardId, stats))
    );
    hydrateLocalFromRemote(merged);
    setSyncVersion((v) => v + 1);
  }, []);

  // Unlike runMigration, this always re-runs on every sign-in rather than
  // being one-time-flag-guarded - a single settings row is cheap to pull
  // (unlike the ~7000-row progress merge), and "always take the latest
  // remote settings" is the simplest correct rule for a preference blob
  // with no per-item timestamps to reconcile. Two devices editing settings
  // in the same window is an accepted, unsolved edge case (last write
  // wins) - not worth the complexity progress sync's per-card merge has,
  // given how much lower-stakes a filter preference is than an SM-2 grade.
  const runSettingsSync = useCallback(async (user) => {
    const local = getPrefs();
    const remoteResult = await pullSettings(user.id);
    if (!remoteResult.ok) return; // fail-open: try again on the next sign-in

    if (remoteResult.data) {
      hydratePrefsFromRemote(remoteResult.data);
    } else {
      await pushSettings(user.id, local);
    }
    setSyncVersion((v) => v + 1);
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
        const user = initialSession.user;
        runCardIdMigration(user).then(() => {
          runMigration(user);
          runSettingsSync(user);
        });
        flushSyncQueue(pushFnFor(user.id));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setCurrentSyncUser(newSession?.user?.id || null);
      if (event === 'SIGNED_IN' && newSession?.user) {
        const user = newSession.user;
        runCardIdMigration(user).then(() => {
          runMigration(user);
          runSettingsSync(user);
        });
        flushSyncQueue(pushFnFor(user.id));
      }
    });

    return () => {
      unsubscribed = true;
      subscription.unsubscribe();
    };
  }, [runCardIdMigration, runMigration, runSettingsSync]);

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
