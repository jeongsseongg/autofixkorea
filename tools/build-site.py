import html
import json
import os
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'tmp' / 'autofix-parser'))
from bs4 import BeautifulSoup

ARCHIVE = ROOT / 'source-archive' / '2026-09-08'
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
(OUT / 'assets').mkdir(exist_ok=True)
REVIEWS = json.loads((ROOT / 'src/content/reviews.json').read_text(encoding='utf-8'))
ROUTES = ['home', 'Home', 'news', 'review', 'download', 'car', '19', 'pro', '21']
ASSETS = json.loads((ROOT / 'src/content/image-map.json').read_text(encoding='utf-8'))
shutil.copytree(ROOT / 'src/assets', OUT / 'assets', dirs_exist_ok=True)
shutil.copytree(ROOT / 'review-images', OUT / 'review-images', dirs_exist_ok=True)
shutil.copytree(ROOT / 'src', OUT / 'src', dirs_exist_ok=True)

def soup(name):
    return BeautifulSoup((ARCHIVE / (name + '.html')).read_text(encoding='utf-8'), 'html.parser')

def css_rules(text):
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    text = re.sub(r'@import\s+[^;]+;', '', text)
    result, pos = [], 0
    while pos < len(text):
        start = text.find('{', pos)
        if start < 0:
            break
        selector, depth, end = text[pos:start].strip(), 1, start + 1
        while end < len(text) and depth:
            depth += (text[end] == '{') - (text[end] == '}')
            end += 1
        body = text[start + 1:end - 1]
        if selector.startswith('@media') or selector.startswith('@supports'):
            body = css_rules(body)
            if body:
                result.append(selector + '{' + body + '}')
        elif re.search(r'(?:\.|#)(?:afh|afx|af-|cbs|afbr|rv6|blg|ofa|af\b)', selector):
            selected = [part for part in selector.split(',') if re.search(r'(?:\.|#)(?:afh|afx|af-|cbs|afbr|rv6|blg|ofa|af\b)',part)]
            result.append(','.join(selected) + '{' + body.replace('!important', '') + '}')
        pos = end
    return '\n'.join(result)

def case_cards(limit=6):
    cards = []
    for i, r in enumerate(REVIEWS[:limit]):
        cards.append(f'''<a class="case-card" href="/review/case-{i+1}"><img src="/review-images/{r['img']}" alt="{html.escape(r['car'])} 사고차 원본 사진" loading="lazy"><div class="case-copy"><small>{r['type']} · {r['date']}</small><h3>{r['title']}</h3><p>{r['short']}</p><strong>{r['price']}</strong><p>상세 처리 과정 보기 →</p></div></a>''')
    return '<div class="case-grid">' + ''.join(cards) + '</div>'

def clean_fragment(fragment, name):
    css = []
    for el in list(fragment.find_all(['script','style','iframe'])):
        el.decompose()
    for el in list(fragment.find_all(['html','head','body'])):
        el.unwrap()
    for el in list(fragment.find_all(True)):
        for attr in list(el.attrs):
            if attr.startswith('on'):
                del el[attr]
        if el.has_attr('style'):
            cls = f'ported-{name}-{len(css)}'
            el['class'] = el.get('class', []) + [cls]
            css.append('.' + cls + '{' + el['style'].replace('!important','') + '}')
            del el['style']
        if el.name == 'img':
            url = el.get('src','')
            if not url:
                el.decompose()
                continue
            if url.startswith('https://images.unsplash.com/photo-1551534831-b2dd5a8c8b4b'):
                el.name = 'span'
                el.string = el.get('alt','원본 이미지 확인 중')
                el.attrs = {'class':'source-image-unavailable'}
                continue
            el['src'] = ASSETS.get(url,url)
        if el.name == 'form':
            el['action'] = '#'
            el['method'] = 'get'
            el.attrs.pop('target',None)
            status = fragment.new_tag('p', attrs={'role':'status','tabindex':'-1'})
            status.string = '상담 화면 미리보기'
            el.append(status)
        if el.name == 'input' and el.get('type') == 'hidden':
            el.decompose()
    return fragment, '\n'.join(css)

HOME = soup('home')
FOOTER = '''<footer class="site-footer"><b class="site-logo">AUTOFIX KOREA</b><p>사고차 매입·수리 전문 서비스</p><a href="/?mode=privacy">개인정보처리방침</a><a href="/?mode=policy">이용약관</a><a href="tel:01041027437">010-4102-7437</a><p>상호명 비알파트너스 · 사업자등록번호 332-33-01622<br>서울특별시 강서구 양천로 94 · 경기도 안산시 단원구 풍전로 53</p><small>견적은 차량 정보와 사진을 기준으로 산정한 1차 예상 견적입니다. 최종 매입금액과 거래 조건은 차량 실물 확인 및 상태 점검 후 확정됩니다.</small></footer>'''
POLICIES = ''
for ident in ['privacyModal','termsModal','contactModal']:
    original = HOME.find(id=ident)
    if original:
        paragraphs = ''.join(str(e) for e in original.find_all(['h2','h3','h4','p','ul']))
        POLICIES += f'<dialog id="{ident}"><button data-close>닫기</button>{paragraphs}</dialog>'

def layout(content, name, title, css=''):
    path = '/' if name == 'home' else '/' + name
    verification = ''.join(str(x) for x in HOME.select('meta[name="naver-site-verification"],meta[name="google-site-verification"]'))
    cssname = name.replace('/','-')
    (OUT / 'assets' / (cssname+'.css')).write_text(css,encoding='utf-8')
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{html.escape(title)} | 오토픽스코리아</title><meta name="description" content="사고차 매입·판매·수리 상담. 사진으로 차량 상태를 확인하고 국내외 비교견적을 안내합니다."><link rel="canonical" href="https://www.autofixkorea.com{path}">{verification}<link rel="stylesheet" href="/assets/{cssname}.css"><link rel="stylesheet" href="/src/site.css"><script type="module" src="/src/app/bootstrap.js"></script></head><body><header class="site-header"><a class="site-logo" href="/">AUTOFIX KOREA</a><nav aria-label="주 메뉴"><a href="/Home">오토픽스코리아</a><a href="/news">매입절차</a><a href="/review">매입후기</a><a href="/download">상담예약</a></nav></header><p class="preview-notice">독립 사이트 미리보기 · 상담 입력은 전송되지 않습니다.</p><main>{content}</main>{FOOTER}{POLICIES}<aside class="sticky-contact"><a href="tel:01041027437">전화 상담</a><a href="https://open.kakao.com/o/sYxxiBph">카카오톡 상담</a><a href="/download">무료 견적신청 →</a></aside></body></html>'''

def home_content(fragment):
    for el in list(fragment.select('.rv6')):
        el.replace_with(BeautifulSoup('<div class="section-title"><p>ACCIDENT CAR REVIEW</p><h2>사고차 매입·수리 사례</h2></div>'+case_cards(3),'html.parser'))
    for el in list(fragment.select('.ofa')):
        el.replace_with(BeautifulSoup('<section class="market-link"><p>AUTOFIX AUCTION</p><h2>오토픽스코리아 경매 매물</h2><p>업체 로그인 후 차량 상세와 입찰 정보를 확인하세요.</p><a href="https://autofix-chi.vercel.app/">경매 사이트에서 매물 확인 →</a></section>','html.parser'))
    for el in list(fragment.select('.afx-footer,.afx-modal')):
        el.decompose()
    for el in fragment.select('[data-t]'):
        el.string = el['data-t']
    title = fragment.select_one('#cbs-tw')
    if title:
        title.string = '사진 한 장으로 시작하는 사고차 상담'
    for el in fragment.select('.cbs-datelabel'):
        el.string = '상담 예시'
    blog = fragment.select_one('#blgGrid')
    if blog:
        posts = json.loads((ROOT / 'src/content/blog.json').read_text(encoding='utf-8'))
        cards = ''.join(f'<a href="{r["url"]}"><small>NAVER BLOG · {r["date"]}</small>{r["title"]}<p>네이버 블로그에서 보기 →</p></a>' for r in posts)
        blog.replace_with(BeautifulSoup('<div class="blog-grid">'+cards+'</div>','html.parser'))
    more = fragment.select_one('#blgMoreBtn')
    if more:
        more.replace_with(BeautifulSoup('<a class="primary-link" href="https://blog.naver.com/j__company">블로그 후기 더 보기 →</a>','html.parser'))
    return fragment

def build_page(name):
    original = soup(name)
    widgets = original.select('[data-widget-type="code"]')
    fragment = BeautifulSoup(''.join(x.decode_contents() for x in widgets),'html.parser')
    if name in ['home','Home']:
        fragment = home_content(fragment)
    if name == 'review':
        grid = fragment.select_one('#afbrGrid')
        if grid:
            grid.replace_with(BeautifulSoup(case_cards(),'html.parser'))
        for el in fragment.select('#afbrDim'):
            el.decompose()
    if name == 'car':
        fragment = BeautifulSoup('<section class="market-link"><h1>오토픽스코리아 경매</h1><p>차량 상세 열람 및 입찰은 기존 경매 사이트에서 진행합니다.</p><a href="https://autofix-chi.vercel.app/">경매 사이트 열기 →</a></section>','html.parser')
    fragment, inline = clean_fragment(fragment,name)
    css = css_rules('\n'.join(x.get_text() for x in original.find_all('style'))) + inline
    if not fragment.get_text(strip=True):
        fragment = BeautifulSoup('<section class="case-detail"><h1>오토픽스코리아</h1><p>이 페이지는 이전 구성을 확인 중입니다.</p><a class="primary-link" href="/download">상담예약</a></section>','html.parser')
    title = fragment.find(['h1','h2'])
    title = title.get_text(' ',strip=True) if title else '사고차 상담'
    dest = OUT / ('index.html' if name == 'home' else name + '/index.html')
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(layout(str(fragment),name,title,css),encoding='utf-8')
    return {'path':'/' if name=='home' else '/'+name,'widgets':len(widgets),'title':title}

results = [build_page(name) for name in ROUTES]
for i, r in enumerate(REVIEWS):
    route = f'review/case-{i+1}'
    content = f'<article class="case-detail"><a href="/review">← 매입후기</a><p>{r["type"]} · {r["date"]}</p><h1>{r["title"]}</h1><img src="/review-images/{r["img"]}" alt="{r["car"]}"><h2>처리 과정</h2><p>{r["process"]}</p><a class="primary-link" href="/download">내 차량 상담하기</a></article>'
    dest = OUT / route / 'index.html'
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(layout(content,route,r['title']),encoding='utf-8')
(OUT/'robots.txt').write_text('User-agent: *\nDisallow: /\n',encoding='utf-8')
(OUT/'_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n',encoding='utf-8')
(OUT/'404.html').write_text(layout('<section class="case-detail"><h1>페이지를 찾을 수 없습니다</h1><a href="/">홈으로 이동</a></section>','404','페이지를 찾을 수 없습니다'),encoding='utf-8')
(ROOT/'source-archive/route-inventory.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('Built',len(results)+len(REVIEWS),'routes; preview is noindex and forms do not transmit.')
