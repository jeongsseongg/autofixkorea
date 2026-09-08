"""One-time resource localization; the production build never calls this tool."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.request
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tmp/autofix-parser'))
from bs4 import BeautifulSoup, Comment

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'src/assets'
mapping={}
pending=set()
templates=list((ROOT/'src/pages').rglob('*.html'))
for path in templates:
    text=path.read_text(encoding='utf-8')
    pending.update(re.findall(r'https://cdn\.imweb\.me/[^\s\"\'<>]+',text))
for path in (ROOT/'src/original-assets').glob('*.css'):
    pending.update(re.findall(r'https://vendor-cdn\.imweb\.me/[^\s\"\')]+',path.read_text(encoding='utf-8')))

def capture(url):
    try:
        request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(request,timeout=25) as response:
            body=response.read()
        if not body:raise ValueError('empty asset')
        suffix=Path(url.split('?',1)[0].split('#',1)[0]).suffix
        name=hashlib.sha256(url.encode()).hexdigest()[:16]+suffix
        (ASSETS/name).write_bytes(body)
        return url,'/assets/'+name
    except Exception:
        return url,None

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for url,local in pool.map(capture,sorted(pending)):
        mapping[url]=local

for path in templates:
    page=BeautifulSoup(path.read_text(encoding='utf-8'),'html.parser')
    for node in list(page.find_all(string=lambda value:isinstance(value,Comment))):node.extract()
    for tag in list(page.find_all(True)):
        if tag.parent is None:continue
        if tag.name=='ul' and 'login_dropdown' in ' '.join(tag.get('class',[])):tag.decompose();continue
        for attr in ['src','href','content']:
            value=tag.get(attr,'')
            if 'imweb.me' in value:
                if mapping.get(value):tag[attr]=mapping[value]
                else:tag.decompose();break
            elif attr=='href' and '.cm' in value:
                tag.decompose();break
        if tag.parent is not None and tag.name=='a' and tag.get('href','').startswith('javascript:'):
            tag.attrs.pop('href',None)
    path.write_text(str(page),encoding='utf-8')
for path in (ROOT/'src/original-assets').glob('*.css'):
    text=path.read_text(encoding='utf-8')
    for url,local in mapping.items():
        if local:text=text.replace(url,local)
    text=re.sub(r'url\([\"\']?https://vendor-cdn\.imweb\.me/[^)]+\)', 'none',text)
    path.write_text(text,encoding='utf-8')

feed_url='https://rss.app/feeds/v1.1/6WtOJP9W5kyr5a0J.json'
with urllib.request.urlopen(urllib.request.Request(feed_url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as response:
    feed=json.load(response)
for item in feed.get('items',[]):
    remote=item.get('image') or item.get('banner_image')
    if remote:
        _,local=capture(remote)
        if local:item['image']=local
(ROOT/'src/content/blog-feed.json').write_text(json.dumps(feed,ensure_ascii=False,indent=2),encoding='utf-8')
print('Localized metadata and CSS resources; saved blog feed with',len(feed.get('items',[])),'items.')
