import { existsSync } from "node:fs";

import { chromium } from "playwright";

import { config } from "./config.js";
import {
  canonicalizeClassName,
  extractClassNameFromTitle,
  extractPostId,
  normalizeText,
  toAbsoluteNaverUrl,
  uniqueBy,
  writeJson,
} from "./utils.js";

const CLASS_MENU_NAMES = ["Ace", "Star", "Top", "Peak", "Champion", "Radiant"];
const CLASS_MENU_SET = new Set(CLASS_MENU_NAMES);
const DEFAULT_CLASS_MENU_ID_MAP = {
  Ace: "38",
  Star: "30",
  Top: "22",
  Peak: "12",
  Champion: "41",
  Radiant: "25",
};
const CLASS_MENU_FUZZY_ALIASES = [
  ["champion", "Champion"],
  ["champ", "Champion"],
  ["radiant", "Radiant"],
  ["ace", "Ace"],
  ["star", "Star"],
  ["peak", "Peak"],
  ["top", "Top"],
];

async function waitForMainFrame(page) {
  for (let i = 0; i < 20; i += 1) {
    const frame = page.frame({ name: "cafe_main" });
    if (frame) {
      return frame;
    }

    await page.waitForTimeout(300);
  }

  return page.mainFrame();
}

async function pageLooksLikeLoginGate(page) {
  const loginUrlPattern = /nidlogin\.login/i;
  if (loginUrlPattern.test(page.url())) {
    return true;
  }

  try {
    const text = await page.evaluate(() => (document.body?.innerText || "").slice(0, 3000));
    return /로그인|아이디|비밀번호/i.test(text);
  } catch {
    return false;
  }
}

function loginRequiredError() {
  return new Error(
    "이 게시판은 로그인 세션이 필요합니다. `npm run login`으로 1회 로그인 세션을 저장한 뒤 `npm run sync`를 다시 실행하세요."
  );
}

async function loginIfNeeded(page) {
  const url = page.url();
  const loginUrlPattern = /nidlogin\.login/i;

  if (!loginUrlPattern.test(url)) {
    return;
  }

  if (!config.naverId || !config.naverPassword) {
    throw new Error(
      "Login required but NAVER_ID / NAVER_PASSWORD are missing. Run `npm run login` once to save session state, or set credentials in .env."
    );
  }

  await page.fill("input#id", config.naverId);
  await page.fill("input#pw", config.naverPassword);

  const loginButton = page.locator("button.btn_login, input.btn_login").first();
  await loginButton.click();
  await page.waitForTimeout(3000);

  if (loginUrlPattern.test(page.url())) {
    throw new Error(
      "Naver login did not complete. If 2FA/captcha is enabled, run `npm run login` for a manual login session."
    );
  }
}

async function pickFirstText(frame, selectors, options = {}) {
  const retries = Math.max(1, options.retries ?? 1);
  const delayMs = Math.max(0, options.delayMs ?? 350);

  for (let attempt = 0; attempt < retries; attempt += 1) {
    for (const selector of selectors) {
      const locator = frame.locator(selector).first();
      if ((await locator.count()) < 1) {
        continue;
      }

      try {
        const text = normalizeText(await locator.innerText());
        if (text) {
          return text;
        }
      } catch {
        // Ignore selector failures and try next.
      }
    }

    if (attempt < retries - 1) {
      await frame.page().waitForTimeout(delayMs);
    }
  }

  return "";
}

async function getPostLinks(frame, options = {}) {
  const limit = Math.max(1, options.limit ?? config.maxPosts);
  const rawLinks = await frame.evaluate(() => {
    function isArticleHref(href) {
      return (
        href.includes("/articles/") ||
        href.includes("ArticleRead.nhn") ||
        href.includes("articleid=") ||
        href.includes("javascript:goArticle(")
      );
    }

    function collect(selector) {
      return Array.from(document.querySelectorAll(selector))
        .map((anchor) => ({
          href: anchor.getAttribute("href") || "",
          title: (anchor.textContent || "").trim(),
        }))
        .filter((item) => isArticleHref(item.href));
    }

    const boardListLinks = collect(".board-list a.article[href]");
    if (boardListLinks.length > 0) {
      return boardListLinks;
    }

    const articleClassLinks = collect("a.article[href]");
    if (articleClassLinks.length > 0) {
      return articleClassLinks;
    }

    return collect("a[href]");
  });

  const links = rawLinks
    .map((item) => ({
      title: normalizeText(item.title),
      url: toAbsoluteNaverUrl(item.href),
      postId: extractPostId(item.href),
    }))
    .filter((item) => item.url)
    .filter((item) => item.postId);

  const deduped = uniqueBy(links, (item) => item.postId);
  const prioritized = prioritizeHomeworkLikeLinks(deduped);
  return prioritized.slice(0, limit);
}

function detectClassFromMenuText(text) {
  const normalized = normalizeText(text)
    .replaceAll("☆", " ")
    .replaceAll("★", " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }

  const canonical = canonicalizeClassName(normalized);
  if (CLASS_MENU_SET.has(canonical)) {
    return canonical;
  }

  for (const [alias, className] of CLASS_MENU_FUZZY_ALIASES) {
    const boundaryPattern = new RegExp(`\\b${alias}\\b`, "i");
    if (boundaryPattern.test(normalized)) {
      return className;
    }
  }

  const compact = normalized.toLowerCase().replace(/[^a-z]/g, "");
  for (const [alias, className] of CLASS_MENU_FUZZY_ALIASES) {
    // Naver menu labels may append unread badges like "N"/"NEW" to class names.
    if (compact === alias || compact === `${alias}n` || compact === `${alias}new`) {
      return className;
    }
  }

  return "";
}

async function collectMenuAnchors(context) {
  try {
    const menus = await context.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors
        .map((anchor) => ({
          href: anchor.getAttribute("href") || "",
          text: (anchor.textContent || "").trim(),
        }))
        .filter((item) => item.href.includes("/menus/"))
        .filter((item) => item.text);
    });
    return Array.isArray(menus) ? menus : [];
  } catch {
    return [];
  }
}

function isLikelyHomeworkTitle(title) {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) {
    return false;
  }

  if (/반\s*숙제/i.test(normalizedTitle)) {
    return true;
  }

  return Boolean(extractClassNameFromTitle(normalizedTitle));
}

function prioritizeHomeworkLikeLinks(links) {
  const likelyHomework = [];
  const others = [];

  for (const link of links) {
    if (isLikelyHomeworkTitle(link.title)) {
      likelyHomework.push(link);
    } else {
      others.push(link);
    }
  }

  if (likelyHomework.length > 0) {
    return likelyHomework;
  }

  return others;
}

async function getPostDetail(context, post) {
  const detailPage = await context.newPage();

  try {
    await detailPage.goto(post.url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await detailPage.waitForTimeout(900);

    const frame = await waitForMainFrame(detailPage);

    const title =
      (await pickFirstText(frame, [
        "h3.title_text",
        ".ArticleTitle .title_text",
        ".title_area .title_text",
        "#app h3",
      ], {
        retries: 10,
        delayMs: 300,
      })) || post.title;

    const bodyText = await pickFirstText(frame, [
      ".se-main-container",
      "#postContent",
      ".article_viewer",
      ".ContentRenderer",
      ".article_container",
      ".ArticleContentBox",
      "article",
      "#app",
    ], {
      retries: 18,
      delayMs: 350,
    });

    const publishedAt = await pickFirstText(frame, [
      ".article_info .date",
      ".WriterInfo .date",
      ".date",
    ], {
      retries: 8,
      delayMs: 250,
    });

    const author = await pickFirstText(frame, [
      ".article_info .nickname",
      ".WriterInfo .nickname",
      ".ArticleTitle .nickname",
      ".writer_area .nickname",
      ".article_writer",
      ".nickname",
    ], {
      retries: 8,
      delayMs: 250,
    });

    return {
      postId: post.postId,
      url: post.url,
      title: normalizeText(title),
      bodyText,
      publishedAt: normalizeText(publishedAt),
      author: normalizeText(author),
      className: post.className || "",
    };
  } finally {
    await detailPage.close();
  }
}

function ensureListViewUrl(url) {
  if (!url) {
    return "";
  }

  if (url.includes("viewType=")) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}viewType=L`;
}

function buildMenuUrlFromBoardUrl(boardUrl, menuId) {
  const raw = String(boardUrl ?? "");
  if (!raw || !menuId) {
    return "";
  }

  const match = raw.match(/\/cafes\/(\d+)\/menus\/\d+/i);
  if (!match?.[1]) {
    return "";
  }

  const cafeId = match[1];
  return `https://cafe.naver.com/f-e/cafes/${cafeId}/menus/${menuId}?viewType=L`;
}

function buildFallbackMenuMap(boardUrl) {
  const fallbackMap = new Map();
  for (const className of CLASS_MENU_NAMES) {
    const menuId = DEFAULT_CLASS_MENU_ID_MAP[className];
    const menuUrl = buildMenuUrlFromBoardUrl(boardUrl, menuId);
    if (menuUrl) {
      fallbackMap.set(className, menuUrl);
    }
  }
  return fallbackMap;
}

async function discoverClassMenus(page, frame, fallbackUrl) {
  const [frameMenus, pageMenus] = await Promise.all([
    collectMenuAnchors(frame),
    collectMenuAnchors(page),
  ]);
  const rawMenus = uniqueBy(frameMenus.concat(pageMenus), (item) => `${item.href}::${item.text}`);

  const discovered = new Map();
  for (const menu of rawMenus) {
    const className = detectClassFromMenuText(menu.text);
    if (!CLASS_MENU_SET.has(className)) {
      continue;
    }

    if (discovered.has(className)) {
      continue;
    }

    const url = ensureListViewUrl(toAbsoluteNaverUrl(menu.href));
    if (url) {
      discovered.set(className, url);
    }
  }

  const fallbackMenus = buildFallbackMenuMap(fallbackUrl);
  if (discovered.size < CLASS_MENU_NAMES.length) {
    for (const className of CLASS_MENU_NAMES) {
      if (discovered.has(className)) {
        continue;
      }

      const fallbackMenuUrl = fallbackMenus.get(className);
      if (fallbackMenuUrl) {
        discovered.set(className, fallbackMenuUrl);
      }
    }
  }

  if (discovered.size > 0) {
    const resolved = CLASS_MENU_NAMES.filter((className) => discovered.has(className)).map((className) => ({
      className,
      url: discovered.get(className),
    }));
    console.log(`[collect] class menus: ${resolved.map((item) => item.className).join(", ")}`);
    return resolved;
  }

  const fallbackClassName = canonicalizeClassName(extractClassNameFromTitle(fallbackUrl || ""));
  const singleFallbackMenu = [
    {
      className: fallbackClassName || "",
      url: ensureListViewUrl(fallbackUrl),
    },
  ];
  console.log("[collect] class menu discovery fallback used");
  return singleFallbackMenu;
}

async function mapWithConcurrency(items, limit, mapper) {
  const concurrency = Math.max(1, Math.min(limit, items.length || 1));
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

export async function collectHomeworkPosts() {
  if (!config.boardUrl) {
    throw new Error("Missing required environment variable: NAVER_CAFE_BOARD_URL");
  }

  const browser = await chromium.launch({ headless: config.headless });

  const context = await browser.newContext({
    storageState: existsSync(config.storageStateFile)
      ? config.storageStateFile
      : undefined,
  });

  try {
    const page = await context.newPage();

    await page.goto(config.boardUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    if (config.requireLogin && (await pageLooksLikeLoginGate(page))) {
      throw loginRequiredError();
    }

    await loginIfNeeded(page);

    await page.goto(config.boardUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    if (config.requireLogin && (await pageLooksLikeLoginGate(page))) {
      throw loginRequiredError();
    }

    const frame = await waitForMainFrame(page);
    if (!frame) {
      throw loginRequiredError();
    }

    const classMenus = await discoverClassMenus(page, frame, config.boardUrl);
    const menuPostScanLimit = Math.max(8, config.classPostLimit * 4);

    const linksByClass = [];
    for (const menu of classMenus) {
      await page.goto(menu.url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });

      if (config.requireLogin && (await pageLooksLikeLoginGate(page))) {
        throw loginRequiredError();
      }

      const menuFrame = await waitForMainFrame(page);
      if (!menuFrame) {
        continue;
      }

      const menuLinks = await getPostLinks(menuFrame, { limit: menuPostScanLimit });
      for (const link of menuLinks) {
        linksByClass.push({
          ...link,
          className: menu.className || "",
        });
      }
    }

    const classScopedLinks = uniqueBy(
      linksByClass,
      (item) => `${item.className || ""}:${item.postId}`
    );
    const uniqueLinks = uniqueBy(classScopedLinks, (item) => item.postId).slice(0, config.maxPosts);
    console.log(
      `[collect] class-scoped links=${classScopedLinks.length}, unique posts=${uniqueLinks.length}`
    );

    if (config.requireLogin && uniqueLinks.length < 1) {
      throw loginRequiredError();
    }

    const detailedPosts = await mapWithConcurrency(
      uniqueLinks,
      config.detailConcurrency,
      async (link) => {
        try {
          const detail = await getPostDetail(context, link);
          if (!normalizeText(detail.bodyText)) {
            return null;
          }
          return detail;
        } catch (error) {
          console.error(`[collect] failed for post ${link.postId}: ${error.message}`);
          return null;
        }
      }
    );
    const detailMap = new Map(
      detailedPosts
        .filter(Boolean)
        .map((post) => [post.postId, post])
    );

    const posts = uniqueBy(
      classScopedLinks
        .map((link) => {
          const detail = detailMap.get(link.postId);
          if (!detail) {
            return null;
          }

          return {
            ...detail,
            className: link.className || detail.className || "",
          };
        })
        .filter(Boolean),
      (item) => `${item.className || ""}:${item.postId}`
    );

    if (config.requireLogin && posts.length < 1) {
      throw loginRequiredError();
    }

    await writeJson(config.storageStateFile, await context.storageState());

    return posts;
  } finally {
    await context.close();
    await browser.close();
  }
}
