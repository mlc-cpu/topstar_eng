import path from "node:path";
import { constants as fsConstants } from "node:fs";
import { access, copyFile } from "node:fs/promises";

import { config } from "./config.js";
import { buildChecklist } from "./checklistBuilder.js";
import { renderHomeworkHtml } from "./htmlTemplate.js";
import { collectHomeworkPosts } from "./naverCafeCollector.js";
import { renderIconSvg, renderManifest, renderServiceWorker } from "./pwaAssets.js";
import {
  extractClassNameFromTitle,
  ensureDir,
  writeJson,
  writeText,
} from "./utils.js";

const CLASS_DISPLAY_ORDER = ["Ace", "Star", "Top", "Peak", "Champion", "Radiant"];

function normalizeIdentity(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isHomeworkTitle(title) {
  return /반\s*숙제/i.test(String(title ?? ""));
}

function postSortScore(post) {
  const dateFromPublishedAt = Date.parse(String(post.publishedAt ?? ""));
  if (Number.isFinite(dateFromPublishedAt)) {
    return dateFromPublishedAt;
  }

  const postIdNum = Number.parseInt(String(post.postId ?? ""), 10);
  if (Number.isFinite(postIdNum)) {
    return postIdNum;
  }

  return 0;
}

function classSortOrder(leftClass, rightClass) {
  const leftIndex = CLASS_DISPLAY_ORDER.indexOf(leftClass);
  const rightIndex = CLASS_DISPLAY_ORDER.indexOf(rightClass);

  const leftKnown = leftIndex > -1;
  const rightKnown = rightIndex > -1;
  if (leftKnown && rightKnown) {
    return leftIndex - rightIndex;
  }

  if (leftKnown && !rightKnown) {
    return -1;
  }

  if (!leftKnown && rightKnown) {
    return 1;
  }

  return leftClass.localeCompare(rightClass, "ko");
}

function selectHomeworkPostsByClass(posts, { author, perClassLimit }) {
  const normalizedAuthor = normalizeIdentity(author);
  const filtered = posts.filter((post) => {
    if (!isHomeworkTitle(post.title)) {
      return false;
    }

    const postAuthor = normalizeIdentity(post.author);
    if (normalizedAuthor && !postAuthor.includes(normalizedAuthor)) {
      return false;
    }

    return true;
  });

  const grouped = new Map();
  for (const post of filtered) {
    const className = post.className || extractClassNameFromTitle(post.title);
    if (!className) {
      continue;
    }

    if (!grouped.has(className)) {
      grouped.set(className, []);
    }
    grouped.get(className).push({ ...post, className });
  }

  const orderedClasses = Array.from(grouped.keys()).sort(classSortOrder);
  const selected = [];

  for (const className of orderedClasses) {
    const sortedPosts = grouped
      .get(className)
      .slice()
      .sort((left, right) => postSortScore(right) - postSortScore(left));
    selected.push(...sortedPosts.slice(0, perClassLimit));
  }

  return {
    filteredPosts: filtered.length,
    matchedClasses: orderedClasses.length,
    selectedPosts: selected,
  };
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyAppLogo(sourcePath, outputPath) {
  if (!sourcePath) {
    return false;
  }

  if (!(await fileExists(sourcePath))) {
    return false;
  }

  await copyFile(sourcePath, outputPath);
  return true;
}

async function run() {
  await ensureDir(config.outputDir);

  const posts = await collectHomeworkPosts();
  const allChecklistPosts = buildChecklist(posts, { timeZone: config.timeZone });
  const selected = selectHomeworkPostsByClass(allChecklistPosts, {
    author: config.homeworkAuthor,
    perClassLimit: config.classPostLimit,
  });
  const checklistPosts = selected.selectedPosts;
  const originalFilteredCount = selected.filteredPosts;
  const matchedClassCount = selected.matchedClasses;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      boardUrl: config.boardUrl,
      maxPosts: config.maxPosts,
      classPostLimit: config.classPostLimit,
      homeworkAuthor: config.homeworkAuthor,
      recentPolicy: "author-and-title-filtered-per-class-limit",
      timeZone: config.timeZone,
      pagesUrl: config.pagesUrl,
      shortUrl: config.shortUrl,
    },
    allPostCount: allChecklistPosts.length,
    filteredPostCount: originalFilteredCount,
    matchedClassCount,
    posts: checklistPosts,
  };

  const html = renderHomeworkHtml({
    pageTitle: config.pageTitle,
  });

  await writeJson(config.dataFile, payload);
  await writeText(config.htmlFile, html);
  await writeText(path.join(config.outputDir, "manifest.webmanifest"), renderManifest({ pageTitle: config.pageTitle }));
  await writeText(path.join(config.outputDir, "sw.js"), renderServiceWorker());
  const logoCopied = await copyAppLogo(config.appLogoFile, path.join(config.outputDir, "icon.png"));
  if (!logoCopied) {
    console.warn(
      `[sync] app logo file not found at ${config.appLogoFile}; falling back to generated icon.svg`
    );
  }
  await writeText(path.join(config.outputDir, "icon.svg"), renderIconSvg());
  await writeText(path.join(config.outputDir, ".nojekyll"), "");
  await writeText(path.join(config.outputDir, "short-url.txt"), `${config.shortUrl}\n`);
  await writeJson(config.stateFile, {
    syncedAt: payload.generatedAt,
    postIds: checklistPosts.map((post) => post.postId),
    pagesUrl: config.pagesUrl,
    shortUrl: config.shortUrl,
  });

  console.log(
    `[sync] generated ${checklistPosts.length} post(s) -> ${config.dataFile} and ${config.htmlFile}`
  );
}

run().catch((error) => {
  console.error(`[sync] failed: ${error.stack || error.message}`);
  process.exit(1);
});
