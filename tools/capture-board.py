import concurrent.futures
import hashlib
from pathlib import Path
import sys
import urllib.parse
import urllib.request
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tmp/autofix-parser'))
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'src/content/board'
DEST.mkdir(exist_ok=True)
ORIGIN='https://www.autofixkorea.com/'

def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(request,timeout=30) as response:return response.read()

for ident in ['171162875','170844510']:
    raw=fetch(ORIGIN+'19/?bmode=view&idx='+ident+'&t=board')
    (ROOT/f'source-archive/2026-09-08/board-{ident}.html').write_bytes(raw)
    page=BeautifulSoup(raw,'html.parser')
    board=page.select_one('.board_view')
    if board is None:raise ValueError('Missing source board content')
    # Preserve title, author/date and complete article; platform comment controls are not copied.
    for child in list(board.find_all(recursive=False)):
        if not any(c in child.get('class',[]) for c in ['board-title','board_summary','board_txt_area']):child.decompose()
    def image(tag):
        url=urllib.parse.urljoin(ORIGIN,tag['src'])
        data=fetch(url)
        name=hashlib.sha256(url.encode()).hexdigest()[:16]+Path(urllib.parse.urlparse(url).path).suffix
        (ROOT/'src/assets'/name).write_bytes(data)
        tag['src']='/assets/'+name
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(image,board.select('img[src]')))
    for tag in board.find_all(True):
        for attr in list(tag.attrs):
            if attr.startswith('on') or attr=='style':del tag[attr]
    (DEST/(ident+'.html')).write_text(str(board),encoding='utf-8')
    print('Saved original board',ident,'images',len(board.find_all('img')),flush=True)
