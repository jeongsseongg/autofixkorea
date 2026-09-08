from html.parser import HTMLParser
from pathlib import Path
import concurrent.futures
import hashlib
import json
import urllib.request
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'source-archive/extra-assets'
DEST.mkdir(parents=True,exist_ok=True)
urls = set()
class Images(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'img' and attrs.get('src','').startswith('https://'):
            urls.add(attrs['src'])
for page in (ROOT/'dist').rglob('*.html'):
    Images().feed(page.read_text(encoding='utf-8'))

def download(url):
    suffix = Path(urlsplit(url).path).suffix or '.jpg'
    filename = hashlib.sha256(url.encode()).hexdigest()[:16] + suffix
    try:
        request = urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(request,timeout=20) as response:
            if not response.headers.get('Content-Type','').startswith('image/'):
                raise ValueError('Not an image')
            (DEST/filename).write_bytes(response.read())
        return url,filename
    except Exception as error:
        print('Failed:',url,str(error))
        return url,None
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results=dict(pool.map(download,urls))
manifest={url:name for url,name in results.items() if name}
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Downloaded',len(manifest),'of',len(urls))
