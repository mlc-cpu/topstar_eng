import path from "node:path";

import { config } from "./config.js";
import { buildChecklist } from "./checklistBuilder.js";
import { renderHomeworkHtml } from "./htmlTemplate.js";
import { collectHomeworkPosts } from "./naverCafeCollector.js";
import { renderIconSvg, renderManifest, renderServiceWorker } from "./pwaAssets.js";
import {
  ensureDir,
  parseDateFromText,
  toDateKey,
  writeJson,
  writeText,
} from "./utils.js";

function selectLatestPostingDays(posts, dayCount, timeZone) {
  const mapped = posts.map((post) => {
    const parsed = parseDateFromText(post.postDate || post.publishedAt || post.title);
    const dateKey = parsed ? toDateKey(parsed, timeZone) : "";
    return { post, parsed, dateKey };
  });

  const dated = mapped
    .filter((item) => item.parsed && item.dateKey)
    .sort((a, b) => b.parsed.getTime() - a.parsed.getTime());

  const allowedDateKeys = new Set();
  for (const item of dated) {
    if (allowedDateKeys.has(item.dateKey)) {
      continue;
    }

    allowedDateKeys.add(item.dateKey);
    if (allowedDateKeys.size >= dayCount) {
      break;
    }
  }

  return dated
    .filter((item) => allowedDateKeys.has(item.dateKey))
    .map((item) => item.post);
}

async function run() {
  await ensureDir(config.outputDir);

  const posts = await collectHomeworkPosts();
  const allChecklistPosts = buildChecklist(posts, { timeZone: config.timeZone });
  const checklistPosts = selectLatestPostingDays(
    allChecklistPosts,
    config.recentDays,
    config.timeZone
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      boardUrl: config.boardUrl,
      maxPosts: config.maxPosts,
      recentDays: config.recentDays,
      recentPolicy: "latest-posting-days",
      timeZone: config.timeZone,
    },
    allPostCount: allChecklistPosts.length,
    posts: checklistPosts,
  };

  const html = renderHomeworkHtml({
    pageTitle: config.pageTitle,
  });

  await writeJson(config.dataFile, payload);
  await writeText(config.htmlFile, html);
  await writeText(path.join(config.outputDir, "manifest.webmanifest"), renderManifest({ pageTitle: config.pageTitle }));
  await writeText(path.join(config.outputDir, "sw.js"), renderServiceWorker());
  await writeText(path.join(config.outputDir, "icon.svg"), renderIconSvg());
  await writeText(path.join(config.outputDir, ".nojekyll"), "");
  await writeJson(config.stateFile, {
    syncedAt: payload.generatedAt,
    postIds: checklistPosts.map((post) => post.postId),
  });

  console.log(
    `[sync] generated ${checklistPosts.length} post(s) -> ${config.dataFile} and ${config.htmlFile}`
  );
}

run().catch((error) => {
  console.error(`[sync] failed: ${error.stack || error.message}`);
  process.exit(1);
});
