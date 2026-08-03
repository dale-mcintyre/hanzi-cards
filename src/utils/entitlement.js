// Fetched from the raw file on GitHub - not the app's own deployment - so
// that ANY already-installed copy (web, PWA, or a sideloaded APK that never
// auto-updates) can pick up a change without needing to ship a new build.
// Today public/entitlements.json always says { paywalled: false }; flipping
// that one file is the entire mechanism for turning a paywall on later.
const ENTITLEMENT_URL = 'https://raw.githubusercontent.com/dale-mcintyre/hanzi-cards/main/public/entitlements.json';

const CACHE_KEY = 'hz_entitlement_cache';
const RECHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // don't re-check more than twice a day
const FETCH_TIMEOUT_MS = 5000;

const DEFAULT_ENTITLEMENT = { paywalled: false, message: '' };

function loadCache() {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function saveCache(entitlement) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ entitlement, checkedAt: Date.now() }));
  } catch (e) {
    // localStorage unavailable - harmless, next launch just re-fetches
  }
}

async function fetchRemoteEntitlement() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ENTITLEMENT_URL, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`Entitlement check failed: ${res.status}`);
    const data = await res.json();
    return { paywalled: Boolean(data.paywalled), message: data.message || '' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolves whether this install should currently show a paywall.
 *
 * Deliberately fail-open: any network error, timeout, offline state, or
 * missing cache resolves to DEFAULT_ENTITLEMENT (free) - never to
 * paywalled. A flaky connection or being offline should never accidentally
 * lock a real free user out; the remote JSON is only ever trusted to turn
 * a paywall ON, never relied on to keep one enforced.
 *
 * Re-checks at most twice a day (cached in localStorage) so this never
 * blocks app launch on a network call every time, and the app stays
 * fully usable offline day-to-day - this is a background check-in, not a
 * gate on startup.
 */
export async function getEntitlement() {
  const cached = loadCache();
  const isFresh = cached && Date.now() - cached.checkedAt < RECHECK_INTERVAL_MS;
  if (isFresh) return cached.entitlement;

  try {
    const entitlement = await fetchRemoteEntitlement();
    saveCache(entitlement);
    return entitlement;
  } catch (e) {
    return cached?.entitlement || DEFAULT_ENTITLEMENT;
  }
}
