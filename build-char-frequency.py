"""Builds public/char_freq.json - how often each deck character appears in
real Chinese text - from SUBTLEX-CH-WF.xlsx (the same SUBTLEX-CH subtitle
corpus build-vocab.py ranks the deck by).

SUBTLEX-CH-WF counts words, not characters, so each word's count is
credited once to every character in it (我们 x 1,000 adds 1,000 to both
我 and 们). Summed over every word in the corpus, that's each character's
share of all the Chinese characters in it - what the Progress screen's
"you can read ~N% of everyday text" line is built from.

Reads the .xlsx with the standard library only (it's a zip of XML), so it
runs without pandas. Re-run after rebuilding unified_vocab.json.

Output: {"total": <all Han characters in the corpus>,
         "counts": {"的": 1682530, ...}}   # deck characters only
"""
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.abspath(__file__))
SUBTLEX_PATH = os.path.join(ROOT, 'SUBTLEX-CH-WF.xlsx')
VOCAB_PATH = os.path.join(ROOT, 'public', 'unified_vocab.json')
OUT_PATH = os.path.join(ROOT, 'public', 'char_freq.json')

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
HAN = re.compile(r'[㐀-鿿豈-﫿]')
# Rows 1-3 are the corpus summary lines and the column headers.
FIRST_DATA_ROW = 4


def read_word_counts(path):
    with zipfile.ZipFile(path) as z:
        strings = [
            ''.join(t.text or '' for t in si.iter(f"{{{NS['m']}}}t"))
            for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)
        ]
        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))

    for row in sheet.find('m:sheetData', NS).findall('m:row', NS):
        if int(row.get('r')) < FIRST_DATA_ROW:
            continue
        cells = {c.get('r')[0]: c for c in row.findall('m:c', NS)}
        word_cell, count_cell = cells.get('A'), cells.get('B')
        if word_cell is None or count_cell is None:
            continue
        value = word_cell.find('m:v', NS).text
        word = strings[int(value)] if word_cell.get('t') == 's' else value
        yield word, int(float(count_cell.find('m:v', NS).text))


def main():
    with open(VOCAB_PATH, encoding='utf-8') as f:
        deck_chars = {c for word in json.load(f) for c in word['character']}

    counts = {}
    total = 0
    for word, count in read_word_counts(SUBTLEX_PATH):
        for c in word:
            if HAN.match(c):
                total += count
                counts[c] = counts.get(c, 0) + count

    deck_counts = {c: counts[c] for c in sorted(deck_chars) if c in counts}
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'total': total, 'counts': deck_counts}, f, ensure_ascii=False, separators=(',', ':'))

    covered = sum(deck_counts.values()) / total if total else 0
    print(f'Wrote {len(deck_counts)}/{len(deck_chars)} deck characters to public/char_freq.json '
          f'(the whole deck covers {covered:.1%} of corpus characters)')


if __name__ == '__main__':
    main()
