import {loadArticle} from '../../services/board/index.js';
export async function mount() {
  document.querySelectorAll('.permission_deny').forEach(link=>link.addEventListener('click',()=>alert('권한이 없습니다.')));
  const params=new URLSearchParams(location.search);
  if(params.get('bmode')!=='view')return;
  const target=document.querySelector('[data-widget-type=board]');
  if(!target)return;
  const article=await loadArticle(params.get('idx'));
  if(article)target.innerHTML=article;
}
