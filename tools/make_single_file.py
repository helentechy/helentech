#!/usr/bin/env python3
"""Writes ALL the website's code into one text file: python3 tools/make_single_file.py [output.txt]
Images and video are not code, so they are listed at the end instead of being embedded."""
import os, sys, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "helentech-all-code.txt")
TEXT_EXT = {'.html', '.css', '.js', '.mjs', '.py', '.json', '.sql', '.md', '.txt', '.xml'}
SKIP_DIRS = {'node_modules', '.git', 'archive'}
LT, GT = '<' * 8, '>' * 8   # built from parts so this script never contains the markers itself
OPEN, CLOSE = LT + ' FILE: ', ' ' + GT
END = LT + ' END FILE ' + GT

files = []
for root, dirs, fs in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for f in fs:
        p = os.path.relpath(os.path.join(root, f), '.')
        if p.startswith('assets/img') or os.path.abspath(p) == os.path.abspath(OUT) or p == 'helentech-all-code.txt': continue
        if os.path.splitext(f)[1].lower() in TEXT_EXT or f in {'.env.example', '.vercelignore'}: files.append(p)
top = ('README.md', 'package.json', 'vercel.json', '.env.example', '.vercelignore', 'robots.txt', 'sitemap.xml')
def rank(p):
    for i, (test) in enumerate([lambda: p in top, lambda: p.endswith('.html') and '/' not in p, lambda: p.startswith('assets/css'), lambda: p.startswith('assets/js'), lambda: p.startswith('api/'), lambda: p.startswith('admin/'), lambda: p.startswith('supabase/'), lambda: p.startswith('tools/')]):
        if test(): return (i, p)
    return (9, p)
files.sort(key=rank)
assets = sorted(os.path.relpath(os.path.join(r, f), '.') for r, d, fs in os.walk('assets') for f in fs if os.path.splitext(f)[1].lower() not in TEXT_EXT)
size = {p: os.path.getsize(p) for p in files}

UNPACK = '''import sys, os, re
text = open(sys.argv[1], encoding="utf-8").read()
out = sys.argv[2] if len(sys.argv) > 2 else "my-site"
pattern = re.compile(r"^<{8} FILE: (.+?) >{8}\\n(.*?)\\n<{8} END FILE >{8}$", re.S | re.M)
count = 0
for m in pattern.finditer(text):
    path = os.path.join(out, m.group(1))
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    open(path, "w", encoding="utf-8", newline="").write(m.group(2) + "\\n")
    count += 1
print("Wrote", count, "files into", out, "- now copy your images into", os.path.join(out, "assets", "img"))'''

head = f'''HELENTECH WEBSITE: COMPLETE SOURCE CODE IN ONE FILE
Generated {datetime.date.today().isoformat()}  |  {len(files)} code files  |  {sum(size.values()) // 1024} KB of code

WHAT THIS FILE IS
Every line of code used to build the HelenTech website (pages, styles, scripts, backend API, analytics dashboard,
database SQL, build tools and tests) in one document. Each file is wrapped like this: the first line is eight "<"
symbols, a space, the word FILE, a colon, the file path, then eight ">" symbols; the last line is eight "<" symbols,
END FILE, and eight ">" symbols. Search for "FILE:" to jump between files.

HOW TO REBUILD THE WEBSITE FROM THIS FILE
1. Save this document as helentech-all-code.txt.
2. Copy the lines between the two "unpack.py" markers below into a file called unpack.py, then run:
       python3 unpack.py helentech-all-code.txt my-site
3. Copy your image and video files into my-site/assets/ (they are not code; they are listed at the end of this document).
4. Deploy the my-site folder to Vercel and set the environment variables listed in .env.example (see README.md).

--- begin unpack.py ---
{UNPACK}
--- end unpack.py ---

SECURITY NOTE: this document contains no passwords or API keys. Keys (RESEND_API_KEY, SUPABASE_*) live only in Vercel environment variables.

TABLE OF CONTENTS
''' + ''.join(f'{i + 1:>3}. {p}  ({size[p] / 1024:.1f} KB)\n' for i, p in enumerate(files)) + '\n' + '=' * 78 + '\n'
body = ''
for p in files:
    c = open(p, encoding='utf-8').read().rstrip('\n')
    assert OPEN not in c and END not in c, p + ' contains a marker'
    body += f'\n{OPEN}{p}{CLOSE}\n{c}\n{END}\n'
tail = '\n\nIMAGES AND VIDEO (not code: keep these as separate files in assets/)\n' + ''.join(f'  {p}\n' for p in assets)
open(OUT, 'w', encoding='utf-8').write(head + body + tail)
print(f'{len(files)} code files, {len(assets)} asset files listed -> {OUT}')
