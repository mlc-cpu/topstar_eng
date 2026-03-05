import path from "node:path";
import { constants as fsConstants } from "node:fs";
import { access, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { buildChecklist } from "./checklistBuilder.js";
import { renderHomeworkHtml } from "./htmlTemplate.js";
import { collectHomeworkPosts } from "./naverCafeCollector.js";
import { renderIconSvg, renderManifest, renderServiceWorker } from "./pwaAssets.js";
import {
  extractClassNameFromTitle,
  ensureDir,
  readJson,
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

function hasHomeworkSignal(post) {
  if (isHomeworkTitle(post.title)) {
    return true;
  }

  const className = post.className || extractClassNameFromTitle(post.title);
  return Boolean(className);
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

function parseSyncedAt(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getHourInTimeZone(date, timeZone) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);

  const hour = Number.parseInt(formatted, 10);
  return Number.isFinite(hour) ? hour : 0;
}

function isQuietHour(date, { startHour, endHour, timeZone }) {
  const hour = getHourInTimeZone(date, timeZone);
  if (startHour === endHour) {
    return false;
  }

  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }

  return hour >= startHour || hour < endHour;
}

function hasCooldown(lastSyncedAt, now, cooldownSeconds) {
  if (!(lastSyncedAt instanceof Date) || Number.isNaN(lastSyncedAt.getTime())) {
    return false;
  }

  const cooldownMs = Math.max(0, cooldownSeconds) * 1000;
  if (cooldownMs < 1) {
    return false;
  }

  const elapsedMs = now.getTime() - lastSyncedAt.getTime();
  return elapsedMs >= 0 && elapsedMs < cooldownMs;
}

function remainingCooldownSeconds(lastSyncedAt, now, cooldownSeconds) {
  const cooldownMs = Math.max(0, cooldownSeconds) * 1000;
  const elapsedMs = Math.max(0, now.getTime() - lastSyncedAt.getTime());
  return Math.max(0, Math.ceil((cooldownMs - elapsedMs) / 1000));
}

function selectHomeworkPostsByClass(posts, { author, perClassLimit }) {
  const normalizedAuthor = normalizeIdentity(author);
  const filtered = posts.filter((post) => {
    if (!hasHomeworkSignal(post)) {
      return false;
    }

    const postAuthor = normalizeIdentity(post.author);
    if (normalizedAuthor && postAuthor && !postAuthor.includes(normalizedAuthor)) {
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

export async function runSync(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const scheduled = Boolean(options.scheduled);
  const force = Boolean(options.force);
  const trigger = options.trigger || (scheduled ? "scheduled" : "manual");

  await ensureDir(config.outputDir);
  const previousState = (await readJson(config.stateFile, {})) || {};
  const lastSyncedAt = parseSyncedAt(previousState.syncedAt);

  if (
    scheduled &&
    isQuietHour(now, {
      startHour: config.quietHoursStart,
      endHour: config.quietHoursEnd,
      timeZone: config.timeZone,
    })
  ) {
    console.log(
      `[sync] skipped (quiet hours ${config.quietHoursStart}:00-${config.quietHoursEnd}:00 ${config.timeZone})`
    );
    return {
      status: "quiet_hours_skip",
      skipped: true,
      reason: "quiet_hours",
      syncedAt: previousState.syncedAt || null,
      trigger,
    };
  }

  if (!force && hasCooldown(lastSyncedAt, now, config.refreshCooldownSeconds)) {
    const remaining = remainingCooldownSeconds(
      lastSyncedAt,
      now,
      config.refreshCooldownSeconds
    );
    console.log(`[sync] skipped (cooldown ${remaining}s remaining)`);
    return {
      status: "cooldown_skip",
      skipped: true,
      reason: "cooldown",
      cooldownRemainingSeconds: remaining,
      syncedAt: previousState.syncedAt || null,
      trigger,
    };
  }

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
      detailConcurrency: config.detailConcurrency,
      classPostLimit: config.classPostLimit,
      homeworkAuthor: config.homeworkAuthor,
      recentPolicy: "author-and-homework-signal-per-class-limit",
      refreshCooldownSeconds: config.refreshCooldownSeconds,
      quietHoursStart: config.quietHoursStart,
      quietHoursEnd: config.quietHoursEnd,
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
    ...previousState,
    syncedAt: payload.generatedAt,
    postIds: checklistPosts.map((post) => post.postId),
    lastTrigger: trigger,
    pagesUrl: config.pagesUrl,
    shortUrl: config.shortUrl,
  });

  console.log(
    `[sync] generated ${checklistPosts.length} post(s) -> ${config.dataFile} and ${config.htmlFile}`
  );

  return {
    status: "refreshed",
    skipped: false,
    trigger,
    syncedAt: payload.generatedAt,
    postCount: checklistPosts.length,
    matchedClassCount,
  };
}

function parseCliOptions(argv) {
  const argSet = new Set(argv);
  const scheduled = argSet.has("--scheduled");
  const force = argSet.has("--force");
  return {
    scheduled,
    force,
    trigger: scheduled ? "scheduled" : "cli",
  };
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  const currentFilePath = fileURLToPath(import.meta.url);
  return path.resolve(process.argv[1]) === currentFilePath;
}

if (isDirectExecution()) {
  const cliOptions = parseCliOptions(process.argv.slice(2));
  runSync(cliOptions).catch((error) => {
    console.error(`[sync] failed: ${error.stack || error.message}`);
    process.exit(1);
  });
}
