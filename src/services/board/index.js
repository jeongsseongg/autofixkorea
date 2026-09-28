const ids=new Set(['171162875','170844510']);
export async function loadArticle(id,transport=fetch) {
  if(!ids.has(id))return null;
  const response=await transport(`/content/board/${id}.html`);
  if(!response.ok)throw new Error('ARTICLE_UNAVAILABLE');
  return response.text();
}
