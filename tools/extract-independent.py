"""One-time migration: freeze verified output as editable independent source."""
import json
from pathlib import Path
import re
import shutil
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tmp/autofix-parser'))
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
PAGES = ROOT / 'src/pages'
STYLES = ROOT / 'src/styles/pages'
PAGES.mkdir(parents=True, exist_ok=True)
STYLES.mkdir(parents=True, exist_ok=True)
ROUTES = ['home','news','review','download','car','19','pro','21']

def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')

def blocks(code):
    code = re.sub(r'^window\.\w+\s*=.*?;\s*$', '', code, flags=re.M)
    starts = list(re.finditer(r'^\s*\(function\s*\([^)]*\)\s*\{', code, re.M))
    return [code[m.start():starts[i+1].start() if i+1<len(starts) else len(code)].strip() for i,m in enumerate(starts)]

def feature(name, code):
    code = re.sub(r'^\(function\s*\([^)]*\)\s*\{', 'export function mount() {', code)
    code = re.sub(r'\}\)\(\);\s*$', '}', code)
    write(ROOT / f'src/features/{name}/index.js', code + '\n')

home = (OUT/'original-runtime/home-widget-1.js').read_text(encoding='utf-8')
names = ['consultation-original','chat-demo','auction-preview','review-slider','blog-feed','service-cards','policies']
for name, block in zip(names, blocks(home)):
    feature(name, block)
feature('consultation-bar', blocks((OUT/'original-runtime/home-widget-0.js').read_text(encoding='utf-8'))[0])
feature('purchase-process', blocks((OUT/'original-runtime/news-widget-1.js').read_text(encoding='utf-8'))[0])
feature('purchase-reviews', blocks((OUT/'original-runtime/review-widget-1.js').read_text(encoding='utf-8'))[0])

for name in ROUTES:
    file = OUT/('index.html' if name=='home' else name+'/index.html')
    page = BeautifulSoup(file.read_text(encoding='utf-8'), 'html.parser')
    for tag in list(page.find_all('script')):
        tag.decompose()
    for selector in ['#site_alarm_slidemenu_container','#site_alarm_slidemenu_backdrop','.notification-canvas-container','magnet-shell']:
        for tag in list(page.select(selector)):
            tag.decompose()
    for tag in page.find_all(True):
        tag.attrs.pop('data-origin-event', None)
    for link in page.select('link[rel=stylesheet]'):
        url = link.get('href','')
        if url.startswith('/original-runtime/'):
            source = OUT/url.lstrip('/')
            filename = source.name.replace('-style-', '-').replace('-inline', '-layout')
            write(STYLES/filename, source.read_text(encoding='utf-8'))
            link['href'] = '/src/styles/pages/'+filename
    # Static markup fragments retain the measured layout; CMS runtime is absent.
    parts = []
    for i, widget in enumerate(page.select('[data-widget-type="code"]')):
        key = names[i] if name=='home' else name
        fragment = PAGES/name/(key+'.html')
        write(fragment, str(widget))
        marker = '{{include:'+name+'/'+key+'.html}}'
        widget.replace_with(page.new_string(marker))
        parts.append(str(fragment.relative_to(ROOT)))
    page.body['data-page'] = name
    page.body.append(page.new_tag('script', type='module', src='/src/app/independent.js'))
    write(PAGES/(name+'.html'), str(page))

for file in (OUT/'original-runtime').glob('*.css'):
    if file.stem.startswith('review-case'):
        write(STYLES/file.name, file.read_text(encoding='utf-8'))
manifest = [{'path':'/' if name=='home' else '/'+name,'template':name+'.html'} for name in ROUTES]
manifest.insert(1, {'path':'/Home','template':'home.html'})
write(PAGES/'routes.json', json.dumps(manifest, ensure_ascii=False, indent=2))
print('Independent page source and feature modules extracted; archive is no longer the build source.')
