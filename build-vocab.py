"""Builds public/unified_vocab.json and public/unified_vocab.csv from scratch.

Replaces the previous hewgill.com-scraping pipeline. That pipeline's ultimate
source of truth for definitions was still raw CC-CEDICT text, which lists
dictionary senses in roughly alphabetical-by-pinyin order rather than by how
common a sense actually is - the reason "回" used to surface "Hui ethnic
group (Chinese Muslims)" ahead of the everyday verb "to return".

This version sources vocabulary from src/data/hsk/hsk1.json..hsk6.json - the
"complete-hsk-vocabulary" dataset already vendored in this repo. Each entry
is pre-split into "forms" (one per pronunciation), each carrying its own
already-human-ordered meanings list, which sidesteps most of CC-CEDICT's
ordering problems at the source. CC-CEDICT (cedict_ts.u8) is kept on as a
secondary source, only to extend the deck with high-frequency words that
aren't on the official HSK word lists.

Every row still passes through sanitize_meanings() below, which is a strict
safety net independent of which source produced it: it strips surname/
cross-reference stubs, demotes classifier-only senses, and blocks known
vulgar markers, regardless of source. Every row also gets a `verified` flag:
True means the pinyin reading was unambiguous (or matched a previously
audited override); False means multiple plausible readings existed and the
script had to guess - a worklist for manual spot-checking, not a claim that
the row is wrong.
"""
import os
import re
import json
import pandas as pd
from pypinyin import pinyin as pypinyin_pinyin, Style as PypinyinStyle

HSK_DIR = os.path.join('src', 'data', 'hsk')
CEDICT_PATH = 'cedict_ts.u8'
SUBTLEX_PATH = 'SUBTLEX-CH-WF.xlsx'
# Non-HSK filler words (plain high-frequency vocabulary CC-CEDICT covers but
# the official HSK lists don't) are only added up to this SUBTLEX-CH rank,
# matching the previous deck's size/scope rather than importing all ~99k
# SUBTLEX entries.
MAX_NON_HSK_FREQ_RANK = 5000


# --------------------------------------------------------------------------
# Numeric -> accented pinyin (only needed for CC-CEDICT; the HSK JSON files
# already carry accented pinyin).
# --------------------------------------------------------------------------

TONE_MARKS = {
    'a': 'aāáǎà', 'e': 'eēéěè', 'i': 'iīíǐì',
    'o': 'oōóǒò', 'u': 'uūúǔù', 'ü': 'üǖǘǚǜ',
}
VOWELS = 'aeiouü'


def convert_syllable(syllable):
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
    return ' '.join(convert_syllable(s) for s in numeric_pinyin.split())


def pypinyin_reading(word):
    """Context-aware default reading pypinyin derives from the hanzi
    themselves (not a dictionary lookup) - used only to break ties between
    two otherwise-equally-plausible readings of the same word, never as a
    primary source."""
    syllables = [s[0] for s in pypinyin_pinyin(word, style=PypinyinStyle.TONE)]
    return ' '.join(syllables)


# Confirmed-by-hand exceptions where even the algorithm below (prefer a
# non-stub, non-proper-noun reading; break remaining ties with pypinyin's
# contextless default) still lands on the wrong one. "脏" is the seed
# case: pypinyin's default reading for it is "zàng" (viscera/organ), not
# the far more common everyday "zāng" (dirty) - both readings have
# genuine, non-stub glosses, so nothing earlier in the pipeline catches
# this, and pypinyin's own default has no notion of which is more central.
#
# The rest of this table is a full manual read-through of every word the
# build flagged verified=False in one run (see vocab_review_needed.txt),
# checked by hand against real Mandarin usage rather than any dictionary
# heuristic - a human/LLM audit pass, not an algorithmic one. Most entries
# just confirm the pipeline's own pick (which promotes it to verified=True
# instead of leaving it flagged forever); a few dozen correct a genuine
# mistake, usually the same failure shape as "脏": a compound whose
# idiomatic, neutral-tone reading (e.g. "东西" as "dōng xi" = things) lost
# out to a literal, fully-toned reading (e.g. "dōng xī" = east and west)
# because pypinyin's character-by-character default has no notion of
# neutral-tone sandhi. Extend this table only after checking a specific
# word's generated output by hand - don't guess entries into it.
MANUAL_PINYIN_OVERRIDES = {
    '脏': 'zāng',
    '的': 'de', '了': 'le', '好': 'hǎo', '会': 'huì', '吗': 'ma',
    '要': 'yào', '说': 'shuō', '吧': 'ba', '那': 'nà', '都': 'dōu',
    '没': 'méi', '和': 'hé', '啊': 'a', '还': 'hái', '把': 'bǎ',
    '给': 'gěi', '过': 'guò', '得': 'dé', '看': 'kàn', '着': 'zhe',
    '呢': 'ne', '只': 'zhǐ', '别': 'bié', '哦': 'ó', '告诉': 'gào su',
    '听': 'tīng', '为': 'wèi', '干': 'gàn', '么': 'me', '东西': 'dōng xi',
    '起来': 'qǐ lai', '中': 'zhōng', '嗯': 'en', '更': 'gèng', '打': 'dǎ',
    '当': 'dāng', '见': 'jiàn', '哪': 'nǎ', '行': 'xíng', '将': 'jiāng',
    '车': 'chē', '地方': 'dì fang', '几': 'jǐ', '比': 'bǐ', '出来': 'chū lái',
    '正': 'zhèng', '地': 'dì', '嘛': 'ma', '种': 'zhǒng', '女人': 'nǚ rén',
    '喝': 'hē', '与': 'yǔ', '弄': 'nòng', '过去': 'guò qù', '啦': 'la',
    '跑': 'pǎo', '长': 'cháng', '号': 'hào', '头': 'tóu', '喂': 'wèi',
    '场': 'chǎng', '难': 'nán', '多少': 'duō shao', '哇': 'wa',
    '结果': 'jié guǒ', '当时': 'dāng shí', '喔': 'ō', '远': 'yuǎn',
    '儿': 'ér', '故事': 'gù shi', '妻子': 'qī zi', '发': 'fā', '待': 'dài',
    '倒': 'dào', '离': 'lí', '处': 'chù', '间': 'jiān', '哈': 'hā',
    '分': 'fēn', '少': 'shǎo', '教': 'jiào', '重': 'zhòng', '曾': 'céng',
    '转': 'zhuǎn', '小子': 'xiǎo zi', '强': 'qiáng', '读': 'dú', '片': 'piàn',
    '作': 'zuò', '耶': 'ye', '精神': 'jīng shén', '子': 'zi', '藏': 'cáng',
    '底': 'dǐ', '冲': 'chōng', '脚': 'jiǎo', '生意': 'shēng yi', '卡': 'kǎ',
    '混': 'hùn', '吓': 'xià', '边': 'biān', '假': 'jiǎ', '阿': 'ā',
    '差': 'chà', '尽': 'jǐn', '追': 'zhuī', '约': 'yuē', '恶心': 'ě xīn',
    '数': 'shù', '臭': 'chòu', '朝': 'cháo', '累': 'lèi', '空': 'kōng',
    '圣': 'shèng', '抢': 'qiǎng', '亲': 'qīn', '圈': 'quān', '传': 'chuán',
    '高中': 'gāo zhōng', '王': 'wáng', '弹': 'dàn', '度': 'dù', '背': 'bèi',
    '赚': 'zhuàn', '好事': 'hǎo shì', '吐': 'tǔ', '语': 'yǔ', '调': 'diào',
    '尿': 'niào', '好处': 'hǎo chu', '乐': 'lè', '落': 'luò', '塞': 'sāi',
    '挑': 'tiāo', '切': 'qiè', '炸': 'zhà', '相': 'xiāng', '分子': 'fèn zǐ',
    '结': 'jié', '呐': 'nà', '应': 'yīng', '什': 'shén', '趟': 'tàng',
    '卷': 'juǎn', '刺': 'cì', '合': 'hé', '奇': 'qí', '称': 'chēng',
    '骑': 'qí', '尽量': 'jǐn liàng', '省': 'shěng', '撒': 'sā',
    '罢了': 'bà le', '匹': 'pǐ', '角': 'jiǎo', '症': 'zhèng', '雨': 'yǔ',
    '咯': 'lo', '好玩': 'hǎo wán', '唯': 'wéi', '解': 'jiě', '露': 'lù',
    '板': 'bǎn', '好吃': 'hǎo chī', '胖': 'pàng', '勒': 'lēi', '模': 'mó',
    '重点': 'zhòng diǎn', '体': 'tǐ', '夫': 'fū', '扇': 'shàn', '觉': 'jué',
    '土地': 'tǔ dì', '页': 'yè', '泡': 'pào', '哟': 'yō', '说法': 'shuō fa',
    '老公': 'lǎo gōng', '人家': 'rén jia', '服': 'fú', '系': 'xì',
    '汤': 'tāng', '食': 'shí', '晕': 'yūn', '载': 'zài', '逮': 'dǎi',
    '曲': 'qū', '挡': 'dǎng', '供': 'gōng', '拜拜': 'bái bái', '乘': 'chéng',
    '便宜': 'pián yi', '喷': 'pēn', '划': 'huà', '色': 'sè', '斗': 'dòu',
    '占': 'zhàn', '唉': 'āi', '蒙': 'méng', '劲': 'jìn', '恶': 'è',
    '杆': 'gān', '喽': 'lou', '石': 'shí', '术': 'shù', '沙': 'shā',
    '答': 'dá', '校': 'xiào', '钻': 'zuān', '散': 'sàn', '熬': 'áo',
    '买卖': 'mǎi mai', '乖乖': 'guāi guāi', '档': 'dàng', '量': 'liàng',
    '仔': 'zǎi', '缝': 'fèng', '夹': 'jiā', '扎': 'zhā', '大夫': 'dài fu',
    '侧': 'cè', '足': 'zú', '钉': 'dīng', '教会': 'jiào huì', '率': 'lǜ',
    '尺': 'chǐ', '衣': 'yī', '柜': 'guì', '晃': 'huàng', '片子': 'piān zi',
    '厂': 'chǎng', '口音': 'kǒu yin', '刷': 'shuā', '扁': 'biǎn',
    '降': 'jiàng', '翘': 'qiào', '华': 'huá', '得了': 'dé le', '抹': 'mǒ',
    '妻': 'qī', '价': 'jià', '菲': 'fēi', '本事': 'běn shi', '尾': 'wěi',
    '泥': 'ní', '隆': 'lóng', '倒数': 'dào shǔ', '伯': 'bó', '叶': 'yè',
    '禁': 'jìn', '当晚': 'dàng wǎn', '歪': 'wāi', '当年': 'dāng nián',
    '幢': 'zhuàng', '凉': 'liáng', '拽': 'zhuài', '咋': 'zǎ',
    '正当': 'zhèng dāng', '单子': 'dān zi', '扫': 'sǎo', '折': 'zhé',
    '宿': 'sù', '磨': 'mó', '创': 'chuàng', '不是': 'bù shì', '铺': 'pù',
    '挨': 'ái', '薄': 'báo', '哄': 'hǒng', '浅': 'qiǎn', '横': 'héng', '涨': 'zhǎng',
    '地道': 'dì dao', '澄清': 'chéng qīng', '拧': 'níng', '淋': 'lín',
    '琢磨': 'zuó mo', '结实': 'jiē shi', '温和': 'wēn hé', '拾': 'shí',
    '公道': 'gōng dào', '扒': 'bā', '扛': 'káng', '劈': 'pī',
    '得罪': 'dé zui', '大方': 'dà fang', '把手': 'bǎ shou', '搂': 'lǒu',
    '裁缝': 'cái feng', '工夫': 'gōng fu', '攒': 'zǎn', '盛': 'shèng',
    '乙': 'yǐ', '熨': 'yùn', '款式': 'kuǎn shì', '搁': 'gē', '甭': 'béng',
    '大意': 'dà yì', '分量': 'fèn liang', '跟前': 'gēn qián',
    '出息': 'chū xi', '利害': 'lì hai', '照应': 'zhào ying', '眯': 'mī',
    '播种': 'bō zhǒng',
}

# A few words where the reading above is already right but sanitize_meanings'
# automatic top-3 selection still leads with the wrong sense - usually
# because the truly essential gloss (e.g. "别" + verb = "don't...!") sits
# further down the source's own gloss list than 2 more-literal senses, or a
# gloss that embedded a Chinese cross-reference got cut mid-sentence by
# truncate() into a dangling, confusing fragment. Hand-picked from the same
# audit pass as MANUAL_PINYIN_OVERRIDES above.
MANUAL_MEANING_OVERRIDES = {
    '别': "don't ...!; other; another; different; to leave; to part (from)",
    '干': 'to do; to work; to manage; capable',
    '么': 'suffix used to form interrogative and indefinite pronouns (什么, 怎么, 这么, etc.)',
    '打': 'to hit; to strike; to fight; (in many compound verbs, e.g. 打电话 "to phone")',
    '喝': 'to drink',
    '卡': '(loanword) card; to stop; to block',
    '咯': 'final particle similar to 了 (le), indicating that something is obvious',
    '匹': 'classifier for horses, mules etc; classifier for cloth: bolt; horsepower',
    '弹': 'bullet; pellet; shot; shell',
    '喽': 'final particle equivalent to 了; particle calling attention to or mildly warning of a situation',
    '咋': 'how; why (dialectal equivalent of 怎么)',
    '听': 'to listen to; to hear; to heed; to obey',
}


# --------------------------------------------------------------------------
# Shared gloss sanitizer - the "strict cleaning function" applied uniformly
# to every candidate reading, regardless of whether it came from the HSK
# JSON files or from CC-CEDICT.
# --------------------------------------------------------------------------

CLASSIFIER_ANNOTATION_RE = re.compile(r'CL:[^/;]+')
STUB_RE = re.compile(
    r'^\(?\s*(variant of|old variant of|archaic variant of|see also\b|see\b|'
    r'used in\b|abbr\.?\s*for\b|old name for\b|also written\b|also pr\.|'
    r'Taiwan pr\.)',
    re.IGNORECASE,
)
SURNAME_RE = re.compile(r'^surname\b', re.IGNORECASE)
CLASSIFIER_SENSE_RE = re.compile(r'^classifier for\b', re.IGNORECASE)
CJK_RE = re.compile(r'[一-鿿]')
DANGLING_CONNECTOR_RE = re.compile(r'\b(as in|such as|e\.g\.?|for example|esp\.)\s*$', re.IGNORECASE)

# CC-CEDICT tags taboo entries fairly predictably - this is what lets
# candidates like 鸟's "diao3 -> penis" reading get excluded before it's ever
# considered, rather than relying on it losing a coin-flip against "niao3".
VULGAR_MARKERS = (
    'vulgar', 'obscene', 'profanity', 'swearword', 'swear word', 'curse word',
    'penis', 'vagina', 'genital',
)


def peel_leading_parens(d):
    """Unwraps a leading qualifier like '(coll.) dad' -> 'dad', but if a
    gloss is ENTIRELY one bracketed note with nothing outside it (common for
    grammar particles), unwraps the parens instead of discarding the text."""
    d = d.strip()
    while d.startswith('('):
        depth, close = 0, None
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
    """Cuts inline Chinese example text some glosses embed, and caps overly
    long definitions so flashcard text stays readable."""
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


def sanitize_meanings(raw_glosses):
    """Cleans and buckets a reading's raw gloss list into
    (ordered_meanings, clean_ok):

      - Classifier annotations (CL:...) are stripped from every gloss.
      - Vulgar-marked glosses are dropped outright.
      - Cross-reference stubs (variant of/see also/abbr. for/...) and bare
        surname glosses are demoted to the back.
      - "classifier for ..." senses are demoted just above the stubs - real
        information, but not the everyday verb/noun/adjective sense the
        front of a flashcard definition should lead with.
      - Genuine glosses (everything else) lead, in source order.

    clean_ok is False when nothing but stubs/surnames/classifiers/vulgar
    content survived - i.e. this reading has no real definition to offer and
    should lose to any competing reading that does.
    """
    primary, classifier, stub = [], [], []
    seen = set()
    fallback = None  # last resort if every gloss turns out to be a bare stub
    for raw in raw_glosses:
        g = CLASSIFIER_ANNOTATION_RE.sub('', raw).strip()
        if not g:
            continue
        if any(marker in g.lower() for marker in VULGAR_MARKERS):
            continue
        if fallback is None:
            fallback = g[:80]
        g = truncate(peel_leading_parens(g))
        if not g:
            continue
        key = g.lower()
        if key in seen:
            continue
        seen.add(key)

        stub_match = STUB_RE.match(g)
        if stub_match:
            # A gloss like "variant of 麼|么[me5]" embeds a Chinese
            # cross-reference that truncate() already cut off above, which
            # can leave nothing but the bare connector phrase ("variant
            # of") with no target - showing that fragment to a learner is
            # worse than showing nothing, so drop it outright instead of
            # keeping it as a (confusing) fallback.
            if not g[stub_match.end():].strip(' :.,;-'):
                continue
            stub.append(g)
        elif SURNAME_RE.match(g):
            stub.append(g)
        elif CLASSIFIER_SENSE_RE.match(g):
            classifier.append(g)
        else:
            primary.append(g)

    ordered = (primary + classifier + stub)[:3]
    if not ordered and fallback:
        # Every gloss was a bare cross-reference stub with its target cut
        # off by truncate() (e.g. "variant of 記錄|记录[ji4 lu4]" -> "variant
        # of") - show the untruncated original (with the Chinese reference
        # visible) rather than nothing at all.
        ordered = [fallback]
    return ordered, len(primary) > 0


# --------------------------------------------------------------------------
# Reading (pinyin) selection - shared shape for both sources: a list of
# candidates, each (pinyin, [raw_glosses, ...]).
# --------------------------------------------------------------------------

def choose_best_reading(word, candidates):
    """Picks the best (pinyin, meaning, verified) out of a word's candidate
    readings using, in order:
      1. Drop capitalized-pinyin candidates (CC-CEDICT/HSK-JSON both mark
         proper-noun readings - surnames, place names, ethnic groups - this
         way) unless every candidate is one, since a common word should
         never be tagged as unverified just because it also happens to be
         somebody's surname.
      2. Sanitize each remaining candidate's glosses; drop any whose
         sanitized result is stub-only (no real definition) unless every
         candidate is stub-only.
      3. If exactly one candidate is left, it's unambiguous: verified=True.
      4. Otherwise consult MANUAL_PINYIN_OVERRIDES (hand-audited fixes for
         known problem characters); if it names one of the remaining
         candidates, use it: verified=True.
      5. Otherwise break the tie with pypinyin's contextless default
         reading; if that narrows it to one candidate, use it - but this is
         still a guess pypinyin itself can get wrong (see the module-level
         comment on MANUAL_PINYIN_OVERRIDES), so verified=False.
      6. Otherwise just take the first remaining candidate: verified=False.
    """
    lowercase = [c for c in candidates if not c[0][:1].isupper()]
    pool = lowercase or candidates  # keep proper-noun readings only if that's all there is

    # HSK JSON entries carry one "form" per (traditional-character variant,
    # reading) pair, so a word with no traditional-form ambiguity at all
    # (e.g. "你") can still show up as two candidates that happen to share
    # the exact same pinyin. Merge those before judging ambiguity, or a
    # perfectly unambiguous word gets flagged unverified for no reason.
    merged, order = {}, []
    for pinyin, glosses in pool:
        if pinyin not in merged:
            merged[pinyin] = []
            order.append(pinyin)
        merged[pinyin].extend(glosses)
    pool = [(p, merged[p]) for p in order]

    sanitized = [(pinyin, *sanitize_meanings(glosses)) for pinyin, glosses in pool]
    clean = [c for c in sanitized if c[2]] or sanitized  # (pinyin, meanings, clean_ok)

    if not clean:
        return None, '', False

    if len(clean) == 1:
        pinyin, meanings, _ = clean[0]
        return pinyin, '; '.join(meanings), True

    override = MANUAL_PINYIN_OVERRIDES.get(word)
    if override:
        match = next((c for c in clean if c[0] == override), None)
        if match:
            return match[0], '; '.join(match[1]), True

    # Deliberately NOT tone-stripped: tone is exactly what distinguishes
    # candidates like "jiǎ" vs "jià", so collapsing it here would throw away
    # the one signal this tie-break exists to use.
    ref = pypinyin_reading(word).replace(' ', '').lower()
    matches = [c for c in clean if c[0].replace(' ', '').lower() == ref]
    if len(matches) == 1:
        pinyin, meanings, _ = matches[0]
        return pinyin, '; '.join(meanings), False

    pinyin, meanings, _ = (matches or clean)[0]
    return pinyin, '; '.join(meanings), False


# --------------------------------------------------------------------------
# HSK JSON loading
# --------------------------------------------------------------------------

def load_hsk_words():
    """word -> (level, forms). The hsk{N}.json files are cumulative (hsk6.json
    contains every word from hsk1-6, not just level-6-exclusive ones), so a
    word's level is the lowest-numbered file it appears in."""
    words = {}
    for level in range(1, 7):
        path = os.path.join(HSK_DIR, f'hsk{level}.json')
        with open(path, encoding='utf-8') as f:
            entries = json.load(f)
        for entry in entries:
            word = entry['simplified']
            if word not in words:
                words[word] = (level, entry['forms'])
    print(f"Loaded {len(words)} distinct words across HSK levels 1-6.")
    return words


def build_hsk_row(word, level, forms, freq_rank):
    candidates = [(f['transcriptions']['pinyin'], f['meanings']) for f in forms]
    pinyin, meaning, verified = choose_best_reading(word, candidates)
    if word in MANUAL_MEANING_OVERRIDES:
        meaning, verified = MANUAL_MEANING_OVERRIDES[word], True
    return {
        'character': word,
        'pinyin': pinyin,
        'meaning': meaning,
        'frequency': freq_rank,
        'level': level,
        'verified': verified,
    }


# --------------------------------------------------------------------------
# CC-CEDICT loading (non-HSK filler words only)
# --------------------------------------------------------------------------

def load_cedict_candidates():
    if not os.path.exists(CEDICT_PATH):
        raise FileNotFoundError(
            "cedict_ts.u8 not found in project root. Download CC-CEDICT from "
            "https://www.mdbg.net/chinese/dictionary?page=cc-cedict and place "
            "the extracted file at the project root as 'cedict_ts.u8'."
        )
    candidates = {}
    line_re = re.compile(r'^(\S+)\s+(\S+)\s+\[(.+?)\]\s+/(.+)/$')
    with open(CEDICT_PATH, encoding='utf-8') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            m = line_re.match(line.strip())
            if not m:
                continue
            _traditional, simplified, pinyin_numeric, defs_raw = m.groups()
            accented = numeric_pinyin_to_accented(pinyin_numeric)
            candidates.setdefault(simplified, []).append((accented, defs_raw.split('/')))
    print(f"Loaded {len(candidates)} distinct CC-CEDICT words.")
    return candidates


def build_cedict_row(word, candidates, freq_rank):
    pinyin, meaning, verified = choose_best_reading(word, candidates)
    if pinyin is None:
        return None
    if word in MANUAL_MEANING_OVERRIDES:
        meaning, verified = MANUAL_MEANING_OVERRIDES[word], True
    return {
        'character': word,
        'pinyin': pinyin,
        'meaning': meaning,
        'frequency': freq_rank,
        'level': None,
        'verified': verified,
    }


# --------------------------------------------------------------------------
# Main pipeline
# --------------------------------------------------------------------------

def load_subtlex_ranks():
    if not os.path.exists(SUBTLEX_PATH):
        raise FileNotFoundError(f"'{SUBTLEX_PATH}' not found in project root.")
    print("Loading SUBTLEX-CH frequency rankings...")
    df = pd.read_excel(SUBTLEX_PATH, skiprows=2)
    df = df.rename(columns={'Word': 'character'})
    ranks = {row['character']: rank for rank, row in enumerate(df.to_dict('records'), start=1)}
    print(f"Loaded {len(ranks)} SUBTLEX-CH frequency ranks.")
    return ranks


def process_vocabulary():
    hsk_words = load_hsk_words()
    subtlex_ranks = load_subtlex_ranks()
    cedict = load_cedict_candidates()

    rows = []
    for word, (level, forms) in hsk_words.items():
        rows.append(build_hsk_row(word, level, forms, subtlex_ranks.get(word)))

    dropped, added_non_hsk = 0, 0
    for word, rank in sorted(subtlex_ranks.items(), key=lambda kv: kv[1]):
        if rank > MAX_NON_HSK_FREQ_RANK:
            break
        if word in hsk_words:
            continue
        candidates = cedict.get(word)
        if not candidates:
            dropped += 1
            continue
        row = build_cedict_row(word, candidates, rank)
        if row is None or not row['meaning']:
            dropped += 1
            continue
        rows.append(row)
        added_non_hsk += 1

    unverified = sum(1 for r in rows if not r['verified'])
    print(f"Total vocabulary: {len(rows)} words ({len(hsk_words)} official HSK, {added_non_hsk} high-frequency filler)")
    print(f"  Dropped (no usable CC-CEDICT entry among top {MAX_NON_HSK_FREQ_RANK} SUBTLEX words): {dropped}")
    print(f"  Flagged verified=False (ambiguous reading, needs a human look): {unverified}")

    rows.sort(key=lambda r: (r['frequency'] is None, r['frequency'] if r['frequency'] is not None else 0))

    os.makedirs('public', exist_ok=True)
    json_path = os.path.join('public', 'unified_vocab.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Saved {json_path}")

    csv_path = os.path.join('public', 'unified_vocab.csv')
    pd.DataFrame(rows).to_csv(csv_path, index=False, encoding='utf-8-sig')
    print(f"Saved {csv_path}")

    review_path = 'vocab_review_needed.txt'
    with open(review_path, 'w', encoding='utf-8') as f:
        for r in rows:
            if not r['verified']:
                f.write(f"{r['character']} ({r['pinyin']}) -> {r['meaning']!r}"
                        f" [level={r['level']}, freq={r['frequency']}]\n")
    print(f"Wrote {unverified} unverified rows to {review_path} for manual spot-checking.")


if __name__ == '__main__':
    process_vocabulary()
