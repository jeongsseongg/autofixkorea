"""Archive the original styles and their font/image dependencies without redesign."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'tmp/autofix-parser'))
from bs4 import BeautifulSoup

DEST = ROOT / 'src/original-assets'
DEST.mkdir(exist_ok=True)
ORIGIN = 'https://www.autofixkorea.com/'
index_path = ROOT / 'src/content/appearance-assets.json'
mapping = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {}
failures = []
pending = set()
for path in (ROOT / 'source-archive/2026-09-08').glob('*.html'):
    page = BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')
    pending.update(urllib.parse.urljoin(ORIGIN, e['href']) for e in page.select('link[rel=stylesheet][href]'))
    pending.update(urllib.parse.urljoin(ORIGIN, e['src']) for e in page.select('img[src]') if e['src'] and not e.find_parent('noscript') and not e['src'].startswith('data:'))
    for style in page.find_all('style'):
        pending.update(urllib.parse.urljoin(ORIGIN, ref) for ref in re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', style.text) if not ref.startswith(('data:', '#')))

def fetch(url):
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=35) as response:
            data = response.read()
            if not data:
                raise ValueError('Empty resource response; browser archive required')
            is_css = 'text/css' in response.headers.get('Content-Type', '') or '.css' in url or '/css/' in url
        suffix = '.css' if is_css else Path(urllib.parse.urlparse(url).path).suffix
        name = hashlib.sha256(url.encode()).hexdigest()[:20] + (suffix or '.bin')
        (DEST / name).write_bytes(data)
        children = set()
        if is_css:
            css = data.decode('utf-8', errors='replace')
            refs = re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', css)
            refs += re.findall(r'@import\s+[\"\']([^\"\']+)', css)
            children = {urllib.parse.urljoin(url, r.strip()) for r in refs if not r.startswith(('data:', '#'))}
        return url, name, children, None
    except Exception as error:
        return url, None, set(), str(error)

seen = set(mapping)
for depth in range(5):
    batch = pending - seen
    if not batch:
        break
    seen.update(batch)
    pending = set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for url, name, children, error in pool.map(fetch, sorted(batch)):
            if error:
                failures.append({'url': url, 'error': error})
            else:
                mapping[url] = '/original-assets/' + name
                pending.update(children)
    print('Asset level', depth, 'saved', len(mapping), 'failed', len(failures), flush=True)

for url, local in mapping.items():
    path = DEST / local.split('/')[-1]
    if path.suffix != '.css':
        continue
    css = path.read_text(encoding='utf-8', errors='replace')
    def replace(match):
        ref = match.group(1).strip(' \"\'')
        if ref.startswith(('/original-assets/', 'data:', '#')):
            return match.group(0)
        full = urllib.parse.urljoin(url, ref)
        return 'url("' + mapping.get(full, full) + '")'
    css = re.sub(r'url\(([^)]+)\)', replace, css)
    css = re.sub(r'(@import\s+)([\"\'])([^\"\']+)([\"\'])',
                 lambda m: m[1] + '"' + mapping.get(urllib.parse.urljoin(url, m[3]), urllib.parse.urljoin(url, m[3])) + '"', css)
    path.write_text(css, encoding='utf-8')
(ROOT / 'src/content/appearance-assets.json').write_text(json.dumps(mapping, indent=2), encoding='utf-8')
(ROOT / 'source-archive/appearance-failures.json').write_text(json.dumps(failures, indent=2), encoding='utf-8')
