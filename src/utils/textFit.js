/**
 * Returns a 0-1 scale factor to shrink a base font-size for longer text, so
 * long dictionary definitions (some run 80+ characters) don't overflow their
 * fixed-size containers - e.g. Quiz Mode's card has no scroll of its own.
 * Deliberately simple length-based tiers, not true text measurement - good
 * enough for the short/medium/long shape real definitions actually take.
 */
export function fitScaleForLength(length) {
  if (length <= 20) return 1;
  if (length <= 40) return 0.85;
  if (length <= 65) return 0.7;
  return 0.58;
}
