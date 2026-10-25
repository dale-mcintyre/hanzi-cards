// How each character is put together - public/char_parts.json, built by
// build-char-parts.py from Make Me a Hanzi (LGPL-3.0-or-later, see
// public/licenses/makemeahanzi-NOTICE.txt). Keyed by character; see that
// script's docstring for the field names.

let cachedParts = null;

export async function fetchCharParts() {
  if (cachedParts) return cachedParts;

  try {
    const response = await fetch('/char_parts.json');
    if (!response.ok) throw new Error(`Failed to load character parts: ${response.statusText}`);
    cachedParts = await response.json();
    return cachedParts;
  } catch (error) {
    // Parts are a teaching aid, not core data - everything that uses them
    // falls back to working without.
    console.error('Error loading character parts:', error);
    return {};
  }
}

// IDS operators: ⿲/⿳ take three operands, the rest two.
const IDS_ARITY = { '⿲': 3, '⿳': 3 };
const isIdsOperator = (c) => c >= '⿰' && c <= '⿻';
const UNKNOWN = '？';

// The top-level operands of an IDS string, e.g. "⿰女马" -> ["女", "马"] and
// "⿱⿰木木一" -> ["⿰木木", "一"] - a nested operand comes back as its own
// IDS substring.
function topLevelOperands(ids) {
  let pos = 0;
  function readOperand() {
    const start = pos;
    const c = ids[pos++];
    if (isIdsOperator(c)) {
      for (let i = 0; i < (IDS_ARITY[c] || 2); i++) readOperand();
    }
    return ids.slice(start, pos);
  }
  if (!ids || !isIdsOperator(ids[0])) return [];
  pos = 1;
  const operands = [];
  for (let i = 0; i < (IDS_ARITY[ids[0]] || 2) && pos < ids.length; i++) operands.push(readOperand());
  return operands;
}

/** Every concrete component in a character's decomposition, at any depth. */
export function leafParts(char, parts) {
  const ids = parts?.[char]?.d || '';
  return [...ids].filter((c) => !isIdsOperator(c) && c !== UNKNOWN && c !== char);
}

/**
 * A teachable breakdown of one character, or null when there's nothing
 * worth showing. `parts` is `[{ char, pinyin, meaning, role }]` - role is
 * 'meaning'/'sound' for a pictophonetic character's semantic/phonetic part,
 * else null - and `note` is a one-line explanation of how it's formed.
 */
export function describeCharacter(char, parts) {
  const entry = parts?.[char];
  if (!entry) return null;

  const label = (c, role) => ({ char: c, pinyin: parts[c]?.py, meaning: parts[c]?.m, role });

  let components;
  if (entry.t === 'pictophonetic' && entry.s && entry.p) {
    components = [label(entry.s, 'meaning'), label(entry.p, 'sound')];
  } else {
    // A nested operand (several parts stacked into one) is shown as its
    // leaf characters, unlabeled - there's no single meaning to give it.
    components = topLevelOperands(entry.d || '')
      .map((op) => (op.length === 1 ? label(op, null) : { char: [...op].filter((c) => !isIdsOperator(c) && c !== UNKNOWN).join(''), role: null }))
      .filter((c) => c.char && c.char !== UNKNOWN);
  }

  let note = null;
  if (entry.t === 'pictophonetic') {
    const bits = [];
    if (entry.s) bits.push(`${entry.s} gives the meaning${entry.h ? ` (${entry.h})` : ''}`);
    if (entry.p) bits.push(`${entry.p} gives the sound${parts[entry.p]?.py ? ` (${parts[entry.p].py})` : ''}`);
    note = bits.join(', ') || null;
  } else if (entry.h) {
    note = entry.h;
  }

  if (components.length < 2 && !note) return null;
  return { char, components: components.length >= 2 ? components : [], note };
}
