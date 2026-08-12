import { supabase } from '../lib/supabaseClient';

/**
 * Thin wrapper around the Supabase tables backing Phase 3 (see
 * card_progress / mistake_reports schema in PLAN.md). Every function here
 * is fail-soft - it catches its own errors and returns { ok, error }
 * rather than throwing, so callers (storage.js, syncQueue.js, AuthContext)
 * can decide whether to retry instead of the app crashing on a network
 * blip. Mirrors the fail-open convention already used by utils/entitlement.js.
 */

function unavailable() {
  return { ok: false, error: 'Supabase not configured' };
}

/** Upserts one card's SM-2 stats for a user. Used both for the live push
 * on every grade and for replaying the local->remote side of a merge. */
export async function pushCardProgress(userId, cardId, stats) {
  if (!supabase) return unavailable();
  try {
    const { error } = await supabase.from('card_progress').upsert(
      {
        user_id: userId,
        card_id: cardId,
        repetitions: stats.repetitions ?? 0,
        interval: stats.interval ?? 1,
        ease_factor: stats.easeFactor ?? 2.5,
        last_reviewed: stats.lastReviewed ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,card_id' }
    );
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Fetches every card_progress row for a user, shaped to match the object
 * localStorage's getProgress()/saveCardProgress() already use everywhere
 * else in the app: { [cardId]: { repetitions, interval, easeFactor, lastReviewed } }. */
export async function pullAllProgress(userId) {
  if (!supabase) return unavailable();
  try {
    const { data, error } = await supabase
      .from('card_progress')
      .select('card_id, repetitions, interval, ease_factor, last_reviewed')
      .eq('user_id', userId);
    if (error) return { ok: false, error };

    const progress = {};
    for (const row of data) {
      progress[row.card_id] = {
        repetitions: row.repetitions,
        interval: row.interval,
        easeFactor: row.ease_factor,
        lastReviewed: row.last_reviewed,
      };
    }
    return { ok: true, data: progress };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Pure, synchronous, no network calls - reconciles a local progress object
 * (from getProgress()) against a remote one (from pullAllProgress()).
 *
 * Per card: whichever side has the newer lastReviewed wins (ties favor
 * remote, since remote is already durable). Returns:
 *   - merged: the winning stats per card - write this into localStorage
 *     via storage.js's hydrateLocalFromRemote() so the device ends up with
 *     the true union of both sides.
 *   - toPush: the subset where local won (local-only cards, or local newer
 *     than remote) - push these to Supabase to bring remote up to date.
 */
export function mergeLocalAndRemoteProgress(local, remote) {
  const merged = {};
  const toPush = {};
  const allCardIds = new Set([...Object.keys(local), ...Object.keys(remote)]);

  for (const cardId of allCardIds) {
    const localStat = local[cardId];
    const remoteStat = remote[cardId];

    if (localStat && !remoteStat) {
      merged[cardId] = localStat;
      toPush[cardId] = localStat;
      continue;
    }
    if (!localStat && remoteStat) {
      merged[cardId] = remoteStat;
      continue;
    }

    const localTime = localStat.lastReviewed || 0;
    const remoteTime = remoteStat.lastReviewed || 0;
    if (localTime > remoteTime) {
      merged[cardId] = localStat;
      toPush[cardId] = localStat;
    } else {
      merged[cardId] = remoteStat;
    }
  }

  return { merged, toPush };
}

/** Fetches this user's single study-preferences row, if any. `data: null`
 * (not an error) means the account has no row yet - callers should treat
 * that as "seed remote from local", not a failure. */
export async function pullSettings(userId) {
  if (!supabase) return unavailable();
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('revision_levels, include_non_hsk')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { ok: false, error };
    if (!data) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        revisionLevels: data.revision_levels || [],
        includeNonHsk: data.include_non_hsk ?? true,
      },
    };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Upserts the user's single settings row. Used both for live pushes on
 * every preference change and to seed a brand new account's first row. */
export async function pushSettings(userId, prefs) {
  if (!supabase) return unavailable();
  try {
    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: userId,
        revision_levels: prefs.revisionLevels ?? [],
        include_non_hsk: prefs.includeNonHsk ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Inserts a mistake report. Insert-only from the client by RLS design -
 * there's no corresponding read function; reports are triaged directly in
 * the Supabase dashboard. */
export async function reportMistake(userId, { cardId, character, reason, note }) {
  if (!supabase) return unavailable();
  try {
    const { error } = await supabase.from('mistake_reports').insert({
      user_id: userId,
      card_id: cardId,
      character,
      reason,
      note: note || null,
    });
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
