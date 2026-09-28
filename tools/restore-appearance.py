"""Generate original page DOM/styles and extract its custom widget runtime."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'tmp/autofix-parser'))
from bs4 import BeautifulSoup

OUT = ROOT / 'dist'
ORIGIN = 'https://www.autofixkorea.com/'
MAPPING = json.loads((ROOT / 'src/content/image-map.json').read_text(encoding='utf-8'))
MAPPING.update(json.loads((ROOT / 'src/content/appearance-assets.json').read_text(encoding='utf-8')))
shutil.copytree(ROOT / 'src/original-assets', OUT / 'original-assets', dirs_exist_ok=True)
RUNTIME = OUT / 'original-runtime'
RUNTIME.mkdir(exist_ok=True)

def localize(text):
    text = text.replace('https://raw.githubusercontent.com/jeongsseongg/autofixkorea/main/review-images/', '/review-images/')
    for remote, local in sorted(MAPPING.items(), key=lambda p: -len(p[0])):
        text = text.replace(remote, local)
    return text

def scripts_for(page):
    scripts = []
    for tag in page.find_all('script'):
        code = tag.get_text()
        if 'var carousel_menu_script' in code:
            scripts.append(code.split('var carousel_menu_script', 1)[1].split(';', 1)[1])
        elif "var hiddenSlugs = ['pro']" in code:
            scripts.append(code)
        elif "var selectedBranch = '안산점'" in code:
            scripts.append(code)
    return scripts

def externalize_styles(page, name):
    for i, tag in enumerate(list(page.find_all('style'))):
        path = f'/original-runtime/{name}-style-{i}.css'
        (OUT / path.lstrip('/')).write_text(localize(tag.get_text()), encoding='utf-8')
        link = page.new_tag('link', rel='stylesheet', href=path)
        tag.replace_with(link)
    rules, events = [], []
    for i, tag in enumerate(page.find_all(True)):
        if tag.has_attr('style'):
            cls = 'origin-style-' + str(i)
            tag['class'] = tag.get('class', []) + [cls]
            # Repeated class specificity preserves original inline precedence.
            rules.append('.' + '.'.join([cls] * 12) + '{' + localize(tag['style']) + '}')
            del tag['style']
        for attr in list(tag.attrs):
            if attr.startswith('on'):
                ident = 'origin-event-' + str(i)
                tag['data-origin-event'] = ident
                code = tag[attr]
                events.append('document.querySelector(' + json.dumps('[data-origin-event="' + ident + '"]') + ').addEventListener(' + json.dumps(attr[2:]) + ',function(event){' + code + '});')
                del tag[attr]
    path = f'/original-runtime/{name}-inline.css'
    (OUT / path.lstrip('/')).write_text('\n'.join(rules), encoding='utf-8')
    page.head.append(page.new_tag('link', rel='stylesheet', href=path))
    return '\n'.join(events)

def rewrite_resources(page):
    for tag in page.find_all(True):
        if tag.name == 'img' and (not tag.get('src') or 'photo-1551534831-b2dd5a8c8b4b' in tag.get('src', '')):
            tag.attrs.pop('src', None)
        for attr in ['src', 'href', 'data-original', 'poster']:
            value = tag.get(attr)
            if not isinstance(value, str) or value.startswith(('data:', 'tel:', '#', 'javascript:', 'mailto:')):
                continue
            full = urllib.parse.urljoin(ORIGIN, value)
            if full in MAPPING:
                tag[attr] = MAPPING[full]
            elif attr == 'href' and full.startswith(ORIGIN) and tag.name == 'a':
                tag[attr] = full[len(ORIGIN)-1:]
            elif attr == 'src' and value.startswith('/'):
                tag[attr] = full
        if tag.has_attr('srcset'):
            tag['srcset'] = localize(tag['srcset'])

def build(name):
    archive_name = 'home' if name == 'Home' else name
    raw = (ROOT / f'source-archive/2026-09-08/{archive_name}.html').read_text(encoding='utf-8')
    page = BeautifulSoup(raw, 'html.parser')
    scripts = scripts_for(page)
    for tag in list(page.find_all(['script', 'noscript'])):
        tag.decompose()
    for tag in list(page.select('link[rel=modulepreload],link[rel=canonical],meta[name=robots]')):
        tag.decompose()
    for tag in list(page.find_all(['html', 'head', 'body'])):
        if tag not in [page.html, page.head, page.body]:
            tag.unwrap()
    events = externalize_styles(page, archive_name)
    rewrite_resources(page)
    route = '/' if name == 'home' else '/' + name
    page.head.append(page.new_tag('meta', attrs={'name': 'robots', 'content': 'noindex,nofollow'}))
    page.head.append(page.new_tag('meta', attrs={'name': 'author', 'content': 'AUTOFIX KOREA'}))
    page.head.append(page.new_tag('link', rel='canonical', href=ORIGIN.rstrip('/') + route))
    page.head.append(page.new_tag('link', rel='stylesheet', href='/src/original-shell.css'))
    for form in page.find_all('form'):
        form['action'] = '#'
        form['method'] = 'get'
        form.attrs.pop('target', None)
    imports = ['import "/src/features/original-shell.js";']
    for i, code in enumerate(scripts + [events]):
        if not code.strip():
            continue
        file = f'{archive_name}-widget-{i}.js'
        exposed = re.findall(r'^function\s+(\w+)\s*\(', code, flags=re.MULTILINE)
        code += '\n' + '\n'.join(f'window.{fn} = {fn};' for fn in exposed)
        (RUNTIME / file).write_text(localize(code), encoding='utf-8')
        imports.append(f'await import("/original-runtime/{file}");')
    entry = f'/original-runtime/{archive_name}-entry.js'
    (OUT / entry.lstrip('/')).write_text('\n'.join(imports), encoding='utf-8')
    page.body.append(page.new_tag('script', type='module', src=entry))
    destination = OUT / ('index.html' if name == 'home' else name + '/index.html')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(str(page), encoding='utf-8')

for name in ['home', 'Home', 'news', 'review', 'download', 'car', '19', 'pro', '21']:
    build(name)
print('Original DOM, full styles and custom widget behavior restored for 9 routes.')
