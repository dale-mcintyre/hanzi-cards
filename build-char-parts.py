"""Builds public/char_parts.json - how each character in the deck is put
together - from Make Me a Hanzi's dictionary.txt.

Make Me a Hanzi (https://github.com/skishore/makemeahanzi) is the same
project HanziWriter's stroke data comes from. Its dictionary.txt gives
every character an Ideographic Description Sequence (e.g. "⿰女马" for 妈)
plus, for most, an etymology: pictographic/ideographic with a short hint,
or pictophonetic with its semantic (meaning) and phonetic (sound) parts.

dictionary.txt is licensed under the GNU LGPL, version 3 or later -
public/licenses/makemeahanzi-NOTICE.txt carries the notice, and this file is
a modified subset of it (only the characters this deck uses, plus the
components they're built from, with definitions shortened). Re-run this
script after rebuilding unified_vocab.json so new words get their parts.

Output shape, keyed by character:
    {
      "妈": {"d": "⿰女马", "t": "pictophonetic", "h": "woman",
             "s": "女", "p": "马", "py": "mā", "m": "mother"},
      ...
    }
  d  - decomposition (IDS); missing when Make Me a Hanzi doesn't know it
  t  - etymology type: pictographic | ideographic | pictophonetic
  h  - etymology hint (pictophonetic hints describe the meaning part)
  s  - semantic (meaning) component, pictophonetic only
  p  - phonetic (sound) component, pictophonetic only
  py - first pinyin reading
  m  - first sense of the definition, shortened
Component-only entries (a part like 亻 that isn't itself a deck word)
carry just py/m, enough to label the part in the Learn New step.
"""
import json
import os
import urllib.request

# Pinned to the last commit that touched dictionary.txt, so a rebuild is
# reproducible and the notice can point at the exact source used.
SOURCE_COMMIT = '618dbab8a8ddefb958763c8b4afbaa741a4460de'
SOURCE_URL = f'https://raw.githubusercontent.com/skishore/makemeahanzi/{SOURCE_COMMIT}/dictionary.txt'

ROOT = os.path.dirname(os.path.abspath(__file__))
VOCAB_PATH = os.path.join(ROOT, 'public', 'unified_vocab.json')
OUT_PATH = os.path.join(ROOT, 'public', 'char_parts.json')

# IDS structure operators (U+2FF0..U+2FFB) and Make Me a Hanzi's "unknown
# component" marker - neither is a real part.
IDS_OPERATORS = {chr(c) for c in range(0x2FF0, 0x2FFC)}
UNKNOWN = '？'
MAX_MEANING_CHARS = 32


def short_meaning(definition):
    if not definition:
        return None
    first = definition.split(';')[0].split(',')[0].split('(')[0].strip()
    if len(first) > MAX_MEANING_CHARS:
        # Cut on a word boundary, not mid-word.
        first = first[:MAX_MEANING_CHARS].rsplit(' ', 1)[0] + '…'
    return first or None


def leaf_parts(decomposition):
    return [c for c in decomposition if c not in IDS_OPERATORS and c != UNKNOWN]


def main():
    print(f'Downloading dictionary.txt @ {SOURCE_COMMIT[:7]}...')
    with urllib.request.urlopen(SOURCE_URL) as res:
        lines = res.read().decode('utf-8').splitlines()
    dictionary = {}
    for line in lines:
        if line.strip():
            entry = json.loads(line)
            dictionary[entry['character']] = entry

    with open(VOCAB_PATH, encoding='utf-8') as f:
        vocab = json.load(f)
    deck_chars = {c for word in vocab for c in word['character']}

    out = {}
    components = set()
    for char in sorted(deck_chars):
        entry = dictionary.get(char)
        if not entry:
            continue
        row = {}
        decomposition = entry.get('decomposition') or ''
        if decomposition and not decomposition.startswith(UNKNOWN):
            row['d'] = decomposition
            components.update(p for p in leaf_parts(decomposition) if p != char)
        etymology = entry.get('etymology') or {}
        for src, dst in (('type', 't'), ('hint', 'h'), ('semantic', 's'), ('phonetic', 'p')):
            if etymology.get(src):
                row[dst] = etymology[src]
        if entry.get('pinyin'):
            row['py'] = entry['pinyin'][0]
        meaning = short_meaning(entry.get('definition'))
        if meaning:
            row['m'] = meaning
        out[char] = row

    for part in sorted(components - set(out)):
        entry = dictionary.get(part)
        if not entry:
            continue
        row = {}
        if entry.get('pinyin'):
            row['py'] = entry['pinyin'][0]
        meaning = short_meaning(entry.get('definition'))
        if meaning:
            row['m'] = meaning
        if row:
            out[part] = row

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    covered = sum(1 for c in deck_chars if c in out)
    print(f'Wrote {len(out)} entries ({covered}/{len(deck_chars)} deck characters) to public/char_parts.json')


if __name__ == '__main__':
    main()
