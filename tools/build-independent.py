"""Build only project-owned pages, features and local assets; no network or archive input."""
import json
from pathlib import Path
import re
import shutil
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tmp/autofix-parser'))
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'out'
PAGES=ROOT/'src/pages'
OUT.mkdir(exist_ok=True)
for folder in ['services','config','styles']:
    shutil.copytree(ROOT/'src'/folder,OUT/'src'/folder,dirs_exist_ok=True)
(OUT/'src/app').mkdir(parents=True,exist_ok=True)
shutil.copy2(ROOT/'src/app/independent.js',OUT/'src/app/independent.js')
features=['site-shell','consultation-form','contact-dialog','consultation-bar','chat-demo','auction-preview','review-slider','blog-feed','service-cards','policies','purchase-process','purchase-reviews','promotors','auction-link','board']
for feature in features:
    shutil.copytree(ROOT/'src/features'/feature,OUT/'src/features'/feature,dirs_exist_ok=True)
for folder in ['assets','original-assets']:
    shutil.copytree(ROOT/'src'/folder,OUT/folder,dirs_exist_ok=True)
shutil.copytree(ROOT/'review-images',OUT/'review-images',dirs_exist_ok=True)
shutil.copy2(ROOT/'src/original-shell.css',OUT/'src/original-shell.css')
(OUT/'content').mkdir(exist_ok=True)
shutil.copy2(ROOT/'src/content/blog-feed.json',OUT/'content/blog-feed.json')
shutil.copytree(ROOT/'src/content/board',OUT/'content/board',dirs_exist_ok=True)

def include(match):
    path=(PAGES/match[1]).resolve()
    if not path.is_relative_to(PAGES.resolve()):
        raise ValueError('Invalid template include')
    return path.read_text(encoding='utf-8')

routes=json.loads((PAGES/'routes.json').read_text(encoding='utf-8'))
for route in routes:
    text=re.sub(r'\{\{include:([^}]+)\}\}',include,(PAGES/route['template']).read_text(encoding='utf-8'))
    page=BeautifulSoup(text,'html.parser')
    page.head.append(page.new_tag('link',rel='stylesheet',href='/src/styles/contact-dialog.css'))
    page.body.append(BeautifulSoup('<footer class="af-contact-footer"><a data-contact-direct href="tel:01041027437">전화 상담 010-4102-7437</a></footer>','html.parser'))
    for frame in list(page.find_all('iframe')):
        frame.decompose()
    policy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://ytigiculewerivyytxza.supabase.co; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
    page.head.insert(0,page.new_tag('meta',attrs={'http-equiv':'Content-Security-Policy','content':policy}))
    page.select_one('link[rel=canonical]')['href']='https://www.autofixkorea.com'+route['path']
    path=OUT/('index.html' if route['path']=='/' else route['path'].strip('/')+'/index.html')
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(str(page),encoding='utf-8')

reviews=json.loads((ROOT/'src/content/reviews.json').read_text(encoding='utf-8'))
for i,review in enumerate(reviews):
    route=f'/review/case-{i+1}'
    path=OUT/route.lstrip('/')/'index.html'
    path.parent.mkdir(parents=True,exist_ok=True)
    text='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="canonical" href="https://www.autofixkorea.com'+route+'"><title>'+review['title']+'</title><link rel="stylesheet" href="/src/detail.css"><script type="module" src="/src/app/independent.js"></script></head><body><main><a href="/review">AUTOFIX KOREA · 매입후기</a><h1>'+review['title']+'</h1><img src="/review-images/'+review['img']+'" alt="'+review['car']+'"><p>'+review['process']+'</p></main></body></html>'
    path.write_text(text,encoding='utf-8')
shutil.copy2(ROOT/'src/site.css',OUT/'src/detail.css')
shutil.copytree(ROOT/'src/features/accident-intake',OUT/'consultation',dirs_exist_ok=True)
(OUT/'404.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><title>페이지 없음</title><h1>페이지를 찾을 수 없습니다</h1><a href="/">AUTOFIX KOREA</a></html>',encoding='utf-8')
(OUT/'robots.txt').write_text('User-agent: *\nDisallow: /\n',encoding='utf-8')
(OUT/'_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n',encoding='utf-8')
print('Independent offline build:',len(routes)+len(reviews),'routes. Source: src/pages + feature modules.')
