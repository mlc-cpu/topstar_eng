import {
  buildItemId,
  canonicalizeClassName,
  derivePostDate,
  extractChecklistItems,
  extractClassNameFromTitle,
  toDateKey,
} from "./utils.js";

export function buildChecklist(posts, { timeZone = "Asia/Seoul" } = {}) {
  return posts.map((post) => {
    const parsedItems = extractChecklistItems(post.bodyText);
    const postDate = derivePostDate(post);
    const postDateKey = postDate ? toDateKey(postDate, timeZone) : "";
    const className = canonicalizeClassName(post.className) || extractClassNameFromTitle(post.title);

    const items =
      parsedItems.length > 0
        ? parsedItems.map((text, index) => ({
            id: buildItemId(`${post.postId}:${index}:${text}`),
            text,
          }))
        : [
            {
              id: buildItemId(`${post.postId}:fallback`),
              text: "게시글 원문을 확인하세요.",
            },
          ];

    return {
      postId: post.postId,
      title: post.title,
      url: post.url,
      author: post.author || "",
      className,
      publishedAt: post.publishedAt,
      postDate: postDateKey,
      items,
    };
  });
}
