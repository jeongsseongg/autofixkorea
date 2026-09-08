export async function loadBlog(transport=fetch) {
  const response=await transport('/content/blog-feed.json');
  if (!response.ok) throw new Error('BLOG_FEED_UNAVAILABLE');
  const feed=await response.json();
  if (!Array.isArray(feed.items)) throw new Error('BLOG_FEED_INVALID');
  return feed.items;
}
