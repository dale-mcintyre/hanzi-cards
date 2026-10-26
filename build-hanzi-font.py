"""Builds public/fonts/lxgw-wenkai-subset.woff2 - the Kaiti-style font the
app shows Chinese in - by subsetting LXGW WenKai to just the characters
the app can display.

LXGW WenKai (https://github.com/lxgw/LxgwWenKai) is licensed under the SIL
Open Font License 1.1, with an additional permission to keep its name in
versions subsetted or converted to WOFF2 solely for web font delivery -
which is what this is. The license text is copied to
public/licenses/LXGW-WenKai-OFL.txt.

The full font is ~26 MB, so it isn't committed. To rebuild (after the
vocab, sentences, parts data or app text gain new characters):

    pip install fonttools brotli
    python build-hanzi-font.py path/to/LXGWWenKai-Regular.ttf

Characters come from everything the app renders Chinese from: the vocab
(words and example sentences), public/char_parts.json (components shown
in the parts breakdown) and the source files' own Chinese text.
"""
import glob
import json
import os
import re
import sys

from fontTools import subset

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(ROOT, 'public', 'fonts', 'lxgw-wenkai-subset.woff2')

# CJK ideographs, radicals and punctuation, plus fullwidth forms - the
# Latin text is set in the app's serif web font, not this one.
HAN = re.compile(r'[⺀-⿟　-〿㐀-䶿一-鿿豈-﫿＀-￯]')


def strings_in(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield k
            yield from strings_in(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings_in(v)


def main():
    if len(sys.argv) != 2:
        sys.exit('usage: python build-hanzi-font.py path/to/LXGWWenKai-Regular.ttf')

    chars = set()
    for path in ('public/unified_vocab.json', 'public/char_parts.json'):
        with open(os.path.join(ROOT, path), encoding='utf-8') as f:
            for s in strings_in(json.load(f)):
                chars.update(HAN.findall(s))
    for path in glob.glob(os.path.join(ROOT, 'src', '**', '*.js*'), recursive=True):
        with open(path, encoding='utf-8') as f:
            chars.update(HAN.findall(f.read()))

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    font = subset.load_font(sys.argv[1], options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=''.join(sorted(chars)))
    subsetter.subset(font)
    subset.save_font(font, OUT_PATH, options)
    print(f'Wrote {len(chars)} characters to public/fonts/lxgw-wenkai-subset.woff2 '
          f'({os.path.getsize(OUT_PATH) / 1e6:.2f} MB)')


if __name__ == '__main__':
    main()
