/**
 * localStorage-backed outbox for failed Supabase progress pushes.
 *
 * saveCardProgress() in storage.js writes to localStorage synchronously and
 * unconditionally - a Supabase push is always a secondary, best-effort step.
 * When that push fails (offline, Supabase down, etc.) the grade event goes
 * here instead of being silently dropped, and gets retried later. Keyed by
 * cardId so a card graded multiple times while offline only ever queues its
 * latest stats, not a growing backlog of stale entries for the same card.
 */
export const QUEUE_KEY = 'hz_sync_queue';

function loadQueue() {
  try {
    const saved = localStorage.getItem(QUEUE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error('Failed to load sync queue:', e);
    return {};
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save sync queue:', e);
  }
}

export function enqueue(cardId, stats) {
  const queue = loadQueue();
  queue[cardId] = { stats, attempts: (queue[cardId]?.attempts || 0) + 1 };
  saveQueue(queue);
}

export function dequeue(cardId) {
  const queue = loadQueue();
  if (cardId in queue) {
    delete queue[cardId];
    saveQueue(queue);
  }
}

export function queueSize() {
  return Object.keys(loadQueue()).length;
}

let isFlushing = false;

/**
 * Retries every queued item via pushFn(cardId, stats) -> Promise<{ok}>.
 * Items that still fail stay queued for the next flush; a flush already in
 * progress is skipped rather than run twice concurrently.
 */
export async function flush(pushFn) {
  if (isFlushing) return;
  const queue = loadQueue();
  const entries = Object.entries(queue);
  if (entries.length === 0) return;

  isFlushing = true;
  try {
    for (const [cardId, { stats }] of entries) {
      try {
        const result = await pushFn(cardId, stats);
        if (result?.ok) {
          dequeue(cardId);
        }
      } catch (e) {
        // Leave it queued - next flush (on reconnect, sign-in, or next
        // grade) will retry. No backoff bookkeeping beyond `attempts`;
        // this app's sync volume is small enough not to need it.
      }
    }
  } finally {
    isFlushing = false;
  }
}
