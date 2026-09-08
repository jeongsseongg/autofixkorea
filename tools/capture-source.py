import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'source-archive' / '2026-09-08'
DEST.mkdir(parents=True, exist_ok=True)
ORIGIN = 'https://www.autofixkorea.com'
ROUTES = {'home': '/', 'Home': '/Home', 'news': '/news', 'review': '/review', 'download': '/download', 'sitemap': '/sitemap.xml', 'robots': '/robots.txt', 'rss': '/rss', 'llms': '/llms.txt'}
ROUTES.update({'car': '/car', '19': '/19', 'pro': '/pro', '21': '/21'})

def capture(item):
    name, route = item
    url = ORIGIN + route
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            suffix = '.txt' if name in ['sitemap', 'robots', 'rss', 'llms'] else '.html'
            filename = ('home-alias' if name == 'Home' else name) + suffix
            (DEST / filename).write_bytes(body)
            return {'url': url, 'file': filename, 'status': response.status, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
    except Exception as error:
        return {'url': url, 'error': str(error)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(capture, ROUTES.items()))
(DEST / 'pages.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
