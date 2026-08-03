import os
import re
import json
import pandas as pd
import requests
from bs4 import BeautifulSoup

# Tone-mark table for converting CC-CEDICT's numeric pinyin (e.g. "zhong1")
# into the accented form the frontend expects (e.g. "zhōng").
TONE_MARKS = {
    'a': 'aāáǎà',
    'e': 'eēéěè',
    'i': 'iīíǐì',
    'o': 'oōóǒò',
    'u': 'uūúǔù',
    'ü': 'üǖǘǚǜ',
}
VOWELS = 'aeiouü'


def convert_syllable(syllable):
    """Numeric pinyin syllable -> accented syllable (u:/v -> ü, tone number consumed)."""
    syllable = syllable.replace('u:', 'ü').replace('v', 'ü')
    match = re.match(r'^([a-zü]+)([1-5])?$', syllable, re.IGNORECASE)
    if not match:
        return syllable
    letters, tone = match.group(1), match.group(2)
    tone = int(tone) if tone else 5
    lower = letters.lower()

    if tone == 5:
        return letters

    if 'a' in lower:
        pos = lower.index('a')
    elif 'e' in lower:
        pos = lower.index('e')
    elif 'ou' in lower:
        pos = lower.index('o')
    else:
        positions = [i for i, c in enumerate(lower) if c in VOWELS]
        if not positions:
            return letters
        pos = positions[-1]

    vowel = lower[pos]
    marked = TONE_MARKS[vowel][tone]
    return letters[:pos] + marked + letters[pos + 1:]


def numeric_pinyin_to_accented(numeric_pinyin):
    """'zhong1 guo2' -> 'zhōng guó'"""
    return ' '.join(convert_syllable(s) for s in numeric_pinyin.split())


def load_hsk_data():
    """Scrapes curated pinyin + definition + level from Greg Hewgill's HSK
    word lists (https://hewgill.com/hsk/) - one canonical, learner-appropriate
    reading and definition per official HSK word, with no dictionary-style
    homograph ambiguity, since each list is hand-curated per word.

    The original version of this function fetched real data successfully
    (4994 words) but silently produced unusable output: `requests` guesses a
    response's text encoding from its Content-Type header, and hewgill.com's
    header omits a charset (only the HTML's own <meta charset=utf-8> tag
    declares it, which `requests` doesn't read) - so every page decoded as
    ISO-8859-1 instead of UTF-8, turning all the Chinese text into mojibake.
    Those garbled keys never matched SUBTLEX's correctly-decoded words, so
    this whole source silently contributed nothing. Forcing `response.encoding
    = 'utf-8'` before reading `.text` fixes it. Separately, `find_all('tr')[1:]`
    assumed a header row that doesn't exist on these pages, silently dropping
    word #1 of every level - fixed by not slicing it off.

    Falls back to an empty dict per level (rather than crashing the whole
    build) if hewgill.com is unreachable; process_vocabulary() then covers
    those words via CC-CEDICT instead, same as any non-HSK word.

    Some characters appear on more than one level's list with a genuinely
    different reading each time - e.g. 看 is "kān" (to look after) on the
    HSK1 list but "kàn" (to see) on HSK3 - because hewgill teaches the two
    senses at different stages. Since this app has one entry per character,
    _pick_hsk_reading() below resolves those cases."""
    hsk_candidates = {}
    for level in range(1, 7):
        url = f"https://hewgill.com/hsk/hsk{level}.html"
        try:
            response = requests.get(url, timeout=15)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"  Warning: failed to fetch HSK {level} from hewgill.com ({e}); "
                  f"those words will fall back to CC-CEDICT.")
            continue

        response.encoding = 'utf-8'
        soup = BeautifulSoup(response.text, 'html.parser')
        for tr in soup.find_all('tr'):
            cols = [td.text.strip() for td in tr.find_all('td')]
            if len(cols) < 3:
                continue
            word, pinyin = cols[1], cols[2]
            definition = cols[3] if len(cols) > 3 else ''
            if word:
                hsk_candidates.setdefault(word, []).append(
                    {'hsk_level': level, 'pinyin': pinyin, 'definition': definition}
                )

    hsk_dict = {word: _pick_hsk_reading(word, entries) for word, entries in hsk_candidates.items()}
    print(f"Loaded {len(hsk_dict)} curated HSK words from hewgill.com "
          f"({sum(1 for e in hsk_candidates.values() if len(e) > 1)} appeared on multiple levels).")
    return hsk_dict


def _pick_hsk_reading(word, entries):
    """Resolves a word that hewgill.com lists on more than one HSK level.
    Most repeats are the exact same reading/definition (fine, first wins);
    a handful are a genuinely different reading per level. For those, prefer
    whichever entry matches MANUAL_PINYIN_OVERRIDES (already audited for
    exactly this kind of ambiguity); otherwise keep the first (lowest-level)
    entry, same as the original single-pass behavior."""
    if len(entries) == 1:
        return entries[0]
    override = MANUAL_PINYIN_OVERRIDES.get(word)
    if override:
        match = next((e for e in entries if e['pinyin'].lower() == override.lower()), None)
        if match:
            return match
    return entries[0]


def spaced_pinyin_for_word(word, raw_pinyin, cedict):
    """Hewgill's pinyin has no spaces between syllables (e.g. 'běijīng'),
    but the frontend's tone-coloring (ColorPinyin) colors per space-separated
    syllable. Cross-reference CC-CEDICT's own entry for the same whole word -
    its numeric pinyin is already syllable-separated - and borrow only its
    SPACING (not its case): CC-CEDICT capitalizes proper-noun readings
    (surnames, ethnic groups...) and a same-sounding capitalized candidate
    can win the match (e.g. 回 matching CC-CEDICT's "Hui2 ethnic group"
    entry instead of "hui2 to return"), which would silently override
    hewgill's own correct, always-lowercase pinyin with the wrong case.
    Falls back to hewgill's own unspaced pinyin if no match - still displays
    correctly, just without per-syllable tone coloring."""
    candidates = cedict.get(word)
    if not candidates:
        return raw_pinyin
    target = raw_pinyin.replace(' ', '').lower()
    for _np, accented_pinyin, _defs in candidates:
        if accented_pinyin.replace(' ', '').lower() == target:
            return accented_pinyin.lower()
    return raw_pinyin


def clean_hewgill_definition(raw_definition):
    """Hewgill defs are ';'-joined and sometimes carry a trailing classifier
    annotation with embedded Chinese (e.g. 'cup; glass; CL:個|个[gè],支[zhī]')
    - reuses the same gloss-cleaning pipeline built for CC-CEDICT, since the
    shape (semicolon-separated short glosses, occasional CL: junk or a
    leading parenthetical qualifier) is the same."""
    defs = raw_definition.split(';')
    glosses = primary_glosses(defs)
    if glosses:
        return '; '.join(glosses)
    return fallback_gloss(defs)


CLASSIFIER_RE = re.compile(r'CL:[^/]+')
CJK_RE = re.compile(r'[一-鿿]')
# Pure cross-references, not real glosses - e.g. "variant of X" or "used in Y".
# These should lose out to any candidate reading that has an actual definition.
ANNOTATION_RE = re.compile(
    r'^\(?\s*(also pr\.|see also\b|see \b|variant of\b|old variant of\b|'
    r'archaic variant of\b|used in\b)',
    re.IGNORECASE,
)
DANGLING_CONNECTOR_RE = re.compile(
    r'\b(as in|such as|e\.g\.?|for example|esp\.)\s*$', re.IGNORECASE
)


def peel_leading_parens(d):
    """Leading qualifiers like '(coll.) father; dad' or '(loanword) coffee'
    aren't the meaning themselves - peel them off to get at the real gloss
    that follows. But some CC-CEDICT glosses - especially for grammar
    particles like 吗 - consist ENTIRELY of one bracketed explanation with
    nothing outside it (e.g. '(question particle for "yes-no" questions)').
    In that case unwrap the outer parens instead of discarding the text,
    since that bracketed note is the only definition CC-CEDICT gives."""
    d = d.strip()
    while d.startswith('('):
        depth = 0
        close = None
        for i, ch in enumerate(d):
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    close = i
                    break
        if close is None:
            break
        remainder = d[close + 1:].strip()
        if remainder:
            d = remainder
            continue
        return d[1:close].strip()
    return d


def truncate(d):
    """Some glosses embed a Chinese example sentence inline - cut those
    (and any paren/connector left dangling by the cut), and cap overly long
    definitions so flashcard text stays readable."""
    d = d.strip()
    cjk_match = CJK_RE.search(d)
    if cjk_match:
        d = d[:cjk_match.start()]
        if d.count('(') > d.count(')'):
            d = d.rsplit('(', 1)[0]
        d = DANGLING_CONNECTOR_RE.sub('', d).rstrip(' ,;:(-').strip()
    if len(d) > 80:
        d = d[:80].rsplit(' ', 1)[0]
        d = DANGLING_CONNECTOR_RE.sub('', d).rstrip(' ,;:(-').strip()
    return d


def primary_glosses(defs):
    """The 1-2 short, genuine glosses in a CC-CEDICT '/'-separated def list,
    with cross-reference stubs and usage-note-only entries dropped. Returns
    [] when every def turned out to be a stub - that's the signal a
    homograph candidate should lose out to one that has a real definition."""
    cleaned = []
    for raw in defs:
        d = CLASSIFIER_RE.sub('', raw).strip()
        if not d or ANNOTATION_RE.match(d):
            continue
        d = truncate(peel_leading_parens(d))
        if not d:
            continue
        if d.lower() not in (c.lower() for c in cleaned):
            cleaned.append(d)
        if len(cleaned) == 2:
            break
    return cleaned


def fallback_gloss(defs):
    """Last resort for words whose every def is a stub (e.g. only 'variant
    of ...') - show something imperfect rather than drop the word."""
    for raw in defs:
        d = truncate(CLASSIFIER_RE.sub('', raw).strip())
        if d:
            return d
    return ''


def load_cedict_candidates():
    """simplified word -> list of (numeric_pinyin, accented_pinyin, defs)
    for every CC-CEDICT entry (traditional-form variant included), in file
    order. Kept as a list rather than first-wins because CC-CEDICT lists
    multiple pronunciations of the same simplified word as separate lines
    (e.g. 吗 has ma2/ma3/ma5 readings) and we need every candidate in hand
    to pick the one that's actually a real, common definition."""
    path = 'cedict_ts.u8'
    if not os.path.exists(path):
        raise FileNotFoundError(
            "cedict_ts.u8 not found in project root. Download CC-CEDICT from "
            "https://www.mdbg.net/chinese/dictionary?page=cc-cedict and place "
            "the extracted file at the project root as 'cedict_ts.u8'."
        )

    candidates = {}
    line_re = re.compile(r'^(\S+)\s+(\S+)\s+\[(.+?)\]\s+/(.+)/$')
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            m = line_re.match(line.strip())
            if not m:
                continue
            _traditional, simplified, pinyin_numeric, defs_raw = m.groups()
            entry = (pinyin_numeric, numeric_pinyin_to_accented(pinyin_numeric), defs_raw.split('/'))
            candidates.setdefault(simplified, []).append(entry)

    print(f"Loaded {len(candidates)} distinct CC-CEDICT words "
          f"({sum(len(v) for v in candidates.values())} pronunciation entries).")
    return candidates


# Common single characters where CC-CEDICT's ordering (roughly alphabetical
# by pinyin among same-character entries, not by frequency) picks the wrong
# reading, sometimes badly - e.g. 比 -> "bi1" (a vulgar slang stub) instead
# of "bi3" (to compare), 鸟 -> "diao3" (vulgar) instead of "niao3" (bird),
# 说 -> "shui4" (to persuade) instead of "shuo1" (to speak), 体 -> "ti1"
# (obscure) instead of "ti3" (body). No algorithmic signal reliably catches
# these; this table was built by auditing every ambiguous single character
# in the generated deck ordered by frequency rank (see conversation history/
# hsk-homograph-heuristics memory), not by guessing at the full space of
# Chinese polyphones. Extend it if another wrong reading surfaces.
MANUAL_PINYIN_OVERRIDES = {
    '要': 'yào', '说': 'shuō', '看': 'kàn', '听': 'tīng', '更': 'gèng',
    '打': 'dǎ', '比': 'bǐ', '弄': 'nòng', '跑': 'pǎo', '号': 'hào',
    '离': 'lí', '强': 'qiáng', '读': 'dú', '作': 'zuò', '几': 'jǐ',
    '儿': 'ér', '令': 'lìng', '场': 'chǎng', '重': 'zhòng', '头': 'tóu',
    '哪': 'nǎ', '行': 'xíng', '混': 'hùn', '吓': 'xià', '追': 'zhuī',
    '约': 'yuē', '圣': 'shèng', '抢': 'qiǎng', '鸟': 'niǎo', '圈': 'quān',
    '落': 'luò', '结': 'jié', '刺': 'cì', '合': 'hé', '奇': 'qí',
    '称': 'chēng', '骑': 'qí', '胖': 'pàng', '体': 'tǐ', '页': 'yè',
    '南': 'nán', '汤': 'tāng', '蹲': 'dūn', '校': 'xiào', '华': 'huá',
    '伯': 'bó', '叶': 'yè',
    # These three are also disambiguated among hewgill.com's OWN multiple
    # per-level entries (see _pick_hsk_reading) - not overriding hewgill's
    # judgment, just picking which of hewgill's own readings is meant here.
    '趟': 'tàng', '与': 'yǔ', '脏': 'zāng',
}


def resolve_word(word, candidates):
    """Picks the best homograph reading + meaning for `word` out of its
    CC-CEDICT candidates. Checks MANUAL_PINYIN_OVERRIDES first; otherwise
    prefers a candidate with a real (non-stub) gloss, then among those, for
    single-character words prefers a neutral-tone (5) reading, since that's
    overwhelmingly the grammatical-particle reading for common single
    characters (吗/的/了/着/呢 etc.) - CC-CEDICT often lists the toned,
    less-common reading first."""
    override_pinyin = MANUAL_PINYIN_OVERRIDES.get(word)
    if override_pinyin:
        # Multiple CC-CEDICT lines can share the same simplified word AND
        # pinyin (e.g. 圣's own "variant of 聖" stub vs 聖's real "holy;
        # sacred" entry, which also simplifies to 圣) - prefer whichever
        # matching-pinyin candidate has a real gloss, not just file order.
        matches = [(ap, defs) for _np, ap, defs in candidates if ap == override_pinyin]
        if matches:
            for ap, defs in matches:
                glosses = primary_glosses(defs)
                if glosses:
                    return ap, '; '.join(glosses)
            ap, defs = matches[0]
            return ap, fallback_gloss(defs)
        print(f"  Warning: override pinyin '{override_pinyin}' for '{word}' "
              f"not found among CC-CEDICT candidates - falling back to heuristics.")

    scored = [(np_, ap, defs, primary_glosses(defs)) for np_, ap, defs in candidates]
    pool = [c for c in scored if c[3]] or scored

    # CC-CEDICT capitalizes the pinyin of any proper-noun reading - surnames
    # ("Du1"), ethnic groups ("Hui2 ethnic group"), place names, given names,
    # etc. Those are real, non-stub glosses, so the has-gloss filter above
    # doesn't catch them, but for a common character (回/都/还/etc.) the
    # proper-noun reading is almost never what's intended, and CC-CEDICT
    # frequently lists it before the everyday lowercase reading (e.g. 回 ->
    # "Hui2 ethnic group (Chinese Muslims)" before "hui2 to return"). Prefer
    # a lowercase-pinyin candidate whenever one with a real gloss exists.
    lowercase_pinyin = [c for c in pool if not c[0][:1].isupper()]
    if lowercase_pinyin:
        pool = lowercase_pinyin

    if len(word) == 1:
        neutral = [c for c in pool if re.match(r'^[a-z]+5$', c[0].strip(), re.IGNORECASE)]
        if neutral:
            pool = neutral

    numeric_pinyin, accented_pinyin, defs, glosses = pool[0]
    meaning = '; '.join(glosses) if glosses else fallback_gloss(defs)
    return accented_pinyin, meaning


def process_vocabulary():
    excel_path = 'SUBTLEX-CH-WF.xlsx'
    if not os.path.exists(excel_path):
        print(f"Error: Could not find '{excel_path}' in the root folder.")
        return

    print("Loading SUBTLEX-CH dataset (skipping metadata rows)...")
    df = pd.read_excel(excel_path, skiprows=2)
    df = df.rename(columns={'Word': 'character', 'W/million': 'freq_per_million'})
    df['freq_rank'] = range(1, len(df) + 1)

    hsk_data = load_hsk_data()
    cedict = load_cedict_candidates()

    def build_hsk_row(word, hsk_entry, freq_rank, freq_per_million):
        pinyin = spaced_pinyin_for_word(word, hsk_entry['pinyin'], cedict)
        meaning = clean_hewgill_definition(hsk_entry['definition']) or hsk_entry['definition']
        return {
            'character': word,
            'pinyin': pinyin,
            'meaning': meaning,
            'level': hsk_entry['hsk_level'],
            'freq_rank': freq_rank,
            'freq_per_million': freq_per_million,
        }

    rows = []
    covered_words = set()
    dropped_no_dict_entry = 0
    hsk_sourced = 0
    for _, row in df.iterrows():
        word = row['character']
        freq_rank = int(row['freq_rank'])
        hsk_entry = hsk_data.get(word)

        if hsk_entry is None and freq_rank > 5000:
            continue

        if hsk_entry:
            # Official HSK word - use hewgill.com's curated single reading and
            # definition (this is the "carefully put together" source), not
            # CC-CEDICT, so there's no homograph-ambiguity risk on these words.
            hsk_sourced += 1
            rows.append(build_hsk_row(word, hsk_entry, freq_rank, round(float(row['freq_per_million']), 2)))
            covered_words.add(word)
            continue

        # Frequency-only word outside the official HSK lists - CC-CEDICT is
        # the only source for these, so it still goes through the
        # homograph-resolution heuristics.
        candidates = cedict.get(word)
        if not candidates:
            dropped_no_dict_entry += 1
            continue
        pinyin, meaning = resolve_word(word, candidates)
        if not meaning:
            dropped_no_dict_entry += 1
            continue

        rows.append({
            'character': word,
            'pinyin': pinyin,
            'meaning': meaning,
            'level': None,
            'freq_rank': freq_rank,
            'freq_per_million': round(float(row['freq_per_million']), 2),
        })
        covered_words.add(word)

    # hewgill.com's HSK lists include compound phrases and idioms (打篮球,
    # 算了, 简体字, 拔苗助长...) that SUBTLEX-CH's own word segmentation
    # doesn't tokenize as single entries, so the loop above never visits
    # them - without this pass they'd be silently missing from the deck
    # despite having real curated data. They get no frequency rank (SUBTLEX
    # has no data on them), so they sort after every ranked word.
    missing_hsk = 0
    for word, hsk_entry in hsk_data.items():
        if word in covered_words:
            continue
        rows.append(build_hsk_row(word, hsk_entry, None, None))
        missing_hsk += 1

    print(f"Total candidate rows (top 5000 by frequency + any HSK word): {len(rows) + dropped_no_dict_entry}")
    print(f"  of which sourced from hewgill.com's curated HSK lists: {hsk_sourced}")
    print(f"  plus {missing_hsk} HSK words/phrases not in SUBTLEX-CH's word list at all (added with no freq rank)")
    print(f"Dropped (no usable CC-CEDICT entry for a non-HSK word): {dropped_no_dict_entry}")
    print(f"Final unified vocabulary size: {len(rows)}")
    print(f"  of which tagged with an HSK level: {sum(1 for r in rows if r['level'] is not None)}")

    os.makedirs('public', exist_ok=True)
    json_output_path = os.path.join('public', 'unified_vocab.json')
    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Success! Unified vocabulary saved to {json_output_path}")

    csv_output_path = os.path.join('public', 'unified_vocab.csv')
    pd.DataFrame(rows).to_csv(csv_output_path, index=False, encoding='utf-8-sig')
    print(f"Spreadsheet version saved to {csv_output_path}")


if __name__ == '__main__':
    process_vocabulary()
