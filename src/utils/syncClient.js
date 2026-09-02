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

/** Upserts one card's SM-2 stats (plus Writing Recall Mode's parallel
 * stats, if present) for a user. Used both for the live push on every
 * grade and for replaying the local->remote side of a merge. Always
 * writes every column in its payload (falling back to defaults for
 * whichever half - reading or writing - the caller didn't touch this
 * time), which is why storage.js's saveCardProgress/saveWritingProgress
 * both merge onto the existing local object before calling this, rather
 * than pushing just their own delta. */
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
        writing_level: stats.writingLevel ?? 0,
        writing_reps: stats.writingReps ?? 0,
        writing_interval_days: stats.writingIntervalDays ?? 0,
        writing_next_due: stats.writingNextDue ?? null,
        last_written_at: stats.lastWrittenAt ?? null,
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
 * else in the app: { [cardId]: { repetitions, interval, easeFactor,
 * lastReviewed, writingLevel, writingReps, writingIntervalDays,
 * writingNextDue, lastWrittenAt } }. */
export async function pullAllProgress(userId) {
  if (!supabase) return unavailable();
  try {
    const { data, error } = await supabase
      .from('card_progress')
      .select('card_id, repetitions, interval, ease_factor, last_reviewed, writing_level, writing_reps, writing_interval_days, writing_next_due, last_written_at')
      .eq('user_id', userId);
    if (error) return { ok: false, error };

    const progress = {};
    for (const row of data) {
      progress[row.card_id] = {
        repetitions: row.repetitions,
        interval: row.interval,
        easeFactor: row.ease_factor,
        lastReviewed: row.last_reviewed,
        writingLevel: row.writing_level ?? 0,
        writingReps: row.writing_reps ?? 0,
        writingIntervalDays: row.writing_interval_days ?? 0,
        writingNextDue: row.writing_next_due,
        lastWrittenAt: row.last_written_at,
      };
    }
    return { ok: true, data: progress };
  } catch (error) {
    return { ok: false, error };
  }
}

const READING_FIELDS = ['repetitions', 'interval', 'easeFactor', 'lastReviewed'];
const WRITING_FIELDS = ['writingLevel', 'writingReps', 'writingIntervalDays', 'writingNextDue', 'lastWrittenAt'];

function pick(stat, fields) {
  const picked = {};
  for (const field of fields) picked[field] = stat[field];
  return picked;
}

/**
 * Pure, synchronous, no network calls - reconciles a local progress object
 * (from getProgress()) against a remote one (from pullAllProgress()).
 *
 * Reading and writing fields are compared and combined independently
 * (reading by lastReviewed, writing by lastWrittenAt), not as one
 * whole-object winner - a device that's ahead on writing but behind on
 * reading (e.g. it just did a writing session offline while another
 * device raced ahead on reading reviews) would otherwise have one whole
 * half of its progress silently overwritten by the other device's stale
 * copy of that half, since both halves now live in the same per-card
 * object. Ties favor remote, since remote is already durable. Returns:
 *   - merged: the winning fields per card (reading half + writing half
 *     combined independently) - write this into localStorage via
 *     storage.js's hydrateLocalFromRemote() so the device ends up with
 *     the true union of both sides.
 *   - toPush: the subset of fields where local won either comparison -
 *     push these to Supabase to bring remote up to date. A card only
 *     appears here with whichever half(s) local actually won, not
 *     necessarily the whole card.
 */
export function mergeLocalAndRemoteProgress(local, remote) {
  const merged = {};
  const toPush = {};
  const allCardIds = new Set([...Object.keys(local), ...Object.keys(remote)]);

  for (const cardId of allCardIds) {
    const localStat = local[cardId] || {};
    const remoteStat = remote[cardId] || {};
    const hasLocal = cardId in local;
    const hasRemote = cardId in remote;

    let mergedFields = {};
    let localWonAnyHalf = false;

    if (hasLocal && !hasRemote) {
      mergedFields = { ...localStat };
      localWonAnyHalf = true;
    } else if (!hasLocal && hasRemote) {
      mergedFields = { ...remoteStat };
    } else {
      const localReadTime = localStat.lastReviewed || 0;
      const remoteReadTime = remoteStat.lastReviewed || 0;
      const readWinner = localReadTime > remoteReadTime ? localStat : remoteStat;
      mergedFields = { ...pick(readWinner, READING_FIELDS) };
      if (readWinner === localStat) localWonAnyHalf = true;

      const localWriteTime = localStat.lastWrittenAt || 0;
      const remoteWriteTime = remoteStat.lastWrittenAt || 0;
      const writeWinner = localWriteTime > remoteWriteTime ? localStat : remoteStat;
      mergedFields = { ...mergedFields, ...pick(writeWinner, WRITING_FIELDS) };
      if (writeWinner === localStat) localWonAnyHalf = true;
    }

    merged[cardId] = mergedFields;
    // Push the FULL merged object (union of both halves), not just the
    // half local won - pushCardProgress's upsert always writes every
    // column, filling in defaults for anything missing from its payload,
    // so pushing a reading-only partial here would blank out remote's
    // writing columns (or vice versa) even though remote's copy of that
    // other half was actually the correct, newer one.
    if (localWonAnyHalf) toPush[cardId] = mergedFields;
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

/** Inserts one beta-feedback submission, from signed-in or anonymous
 * visitors alike (userId may be null). Insert-only from the client by RLS
 * design, mirroring reportMistake - reviewed directly in the Supabase
 * dashboard, no corresponding read function. */
export async function submitFeedback({ userId, email, message }) {
  if (!supabase) return unavailable();
  try {
    const { error } = await supabase.from('beta_feedback').insert({
      user_id: userId || null,
      email: email || null,
      message,
    });
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
