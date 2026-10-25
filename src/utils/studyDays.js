import { pushStudyActivity, pullStudyDays } from './syncClient';

// Which days the user studied, and how their reviews went - the data
// behind "5 of 7 days this week" and "remembered 88% of reviews". Per-card
// progress only keeps each card's latest review, so this is its own small
// log: { 'YYYY-MM-DD': { reviews, passed } }, keyed by local calendar day.
//
//  - LOG_KEY is what the app displays: the synced days plus anything this
//    device hasn't pushed yet.
//  - PENDING_KEY holds counts not yet added to Supabase. They're sent as
//    increments (see pushStudyActivity), so a day studied on two devices
//    adds up rather than one overwriting the other. Anonymous study
//    accumulates here too and is added to the account on first sign-in,
//    same as anonymous card progress.
const LOG_KEY = 'hz_study_days';
const PENDING_KEY = 'hz_study_days_pending';
// How far back the log is kept and pulled - enough for a 30-day retention
// figure and the "last 30 days" consistency count.
const KEEP_DAYS = 60;

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save study days:', e);
  }
}

function addTo(days, day, reviews, passed) {
  const entry = days[day] || { reviews: 0, passed: 0 };
  days[day] = { reviews: entry.reviews + reviews, passed: entry.passed + passed };
}

export function localDay(ts = Date.now()) {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Logs one graded card. Every grade marks today as a study day;
 * `isReview` (the card had already been studied in this skill before) and
 * `isSuccess` feed the retention figure - a brand-new card's first grade
 * isn't a test of memory, so it doesn't count toward it.
 */
export function recordStudy({ isReview, isSuccess }) {
  const day = localDay();
  const reviews = isReview ? 1 : 0;
  const passed = isReview && isSuccess ? 1 : 0;

  const log = read(LOG_KEY);
  addTo(log, day, reviews, passed);
  write(LOG_KEY, log);

  const pending = read(PENDING_KEY);
  addTo(pending, day, reviews, passed);
  write(PENDING_KEY, pending);
}

export function getStudyDays() {
  return read(LOG_KEY);
}

/**
 * Sends pending counts to Supabase, then replaces the local log with the
 * account's days plus whatever's still pending. Fail-soft: anything that
 * didn't send stays pending for next time. Counts are subtracted from
 * pending as they succeed rather than the key being wiped, so a grade
 * logged mid-sync isn't lost.
 */
export async function syncStudyDays(userId) {
  for (const [day, counts] of Object.entries(read(PENDING_KEY))) {
    const result = await pushStudyActivity(day, counts.reviews, counts.passed);
    if (!result.ok) {
      console.error('Supabase study-day push failed', result.error);
      return;
    }
    const pending = read(PENDING_KEY);
    addTo(pending, day, -counts.reviews, -counts.passed);
    if (pending[day].reviews <= 0 && pending[day].passed <= 0) delete pending[day];
    write(PENDING_KEY, pending);
  }

  const since = localDay(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  const remote = await pullStudyDays(userId, since);
  if (!remote.ok) return;

  const log = remote.data;
  for (const [day, counts] of Object.entries(read(PENDING_KEY))) addTo(log, day, counts.reviews, counts.passed);
  write(LOG_KEY, log);
}

export function clearStudyDays() {
  try {
    localStorage.removeItem(LOG_KEY);
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // nothing to clear
  }
}

/**
 * { daysThisWeek, daysLast30, retention } from the log - "this week" is
 * the last 7 days including today. retention is passed/reviews over the
 * last 30 days, or null with too few reviews to mean anything.
 */
export function summarizeStudyDays(days, now = Date.now()) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  let daysThisWeek = 0;
  let daysLast30 = 0;
  let reviews = 0;
  let passed = 0;

  for (let i = 0; i < 30; i++) {
    const entry = days[localDay(now - i * DAY_MS)];
    if (!entry) continue;
    daysLast30 += 1;
    if (i < 7) daysThisWeek += 1;
    reviews += entry.reviews;
    passed += entry.passed;
  }

  return { daysThisWeek, daysLast30, retention: reviews >= 20 ? passed / reviews : null, reviewsLast30: reviews };
}
