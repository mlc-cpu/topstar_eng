import { existsSync } from "node:fs";

import * as cheerio from "cheerio";
import { chromium } from "playwright";

import { config } from "./config.js";
import {
  canonicalizeClassName,
  extractClassNameFromTitle,
  extractPostId,
  normalizeText,
  readJson,
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
const NAVER_PC_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

function extractCafeIdFromBoardUrl(boardUrl) {
  const raw = String(boardUrl ?? "");
  if (!raw) {
    return "";
  }

  const patterns = [
    /\/cafes\/(\d+)/i,
    /[?&]clubid=(\d+)/i,
    /[?&]search\.clubid=(\d+)/i,
    /[?&]cafeid=(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

function extractCafeIdFromStorageState(storageState) {
  if (!storageState || typeof storageState !== "object") {
    return "";
  }

  const cookies = Array.isArray(storageState.cookies) ? storageState.cookies : [];
  for (const cookie of cookies) {
    const pathText = String(cookie?.path ?? "");
    const match = pathText.match(/\/cafes\/(\d+)/i);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

async function resolveCafeIdForCollection() {
  const fromUrl = extractCafeIdFromBoardUrl(config.boardUrl);
  if (fromUrl) {
    return fromUrl;
  }

  const storageState = await readJson(config.storageStateFile, null);
  const fromStorage = extractCafeIdFromStorageState(storageState);
  if (fromStorage) {
    return fromStorage;
  }

  try {
    const response = await fetch(config.boardUrl, {
      headers: {
        "user-agent": NAVER_PC_USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const html = await response.text();
    const fromHtml =
      extractCafeIdFromBoardUrl(html) ||
      (html.match(/clubid=(\d+)/i)?.[1] || "");
    if (fromHtml) {
      return fromHtml;
    }
  } catch {
    // Ignore and fail below.
  }

  return "";
}

function buildApiHeaders({ referer = "", cookie = "" } = {}) {
  return {
    accept: "application/json, text/plain, */*",
    "x-cafe-product": "pc",
    "user-agent": NAVER_PC_USER_AGENT,
    ...(referer ? { referer } : {}),
    ...(cookie ? { cookie } : {}),
  };
}

function formatArticleWriteDate(writeDateTs) {
  const timestamp = Number(writeDateTs);
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function buildMenuUrl(cafeId, menuId) {
  if (!cafeId || !menuId) {
    return "";
  }

  return `https://cafe.naver.com/f-e/cafes/${cafeId}/menus/${menuId}?viewType=L`;
}

function buildArticleUrl(cafeId, menuId, postId) {
  return `https://cafe.naver.com/f-e/cafes/${cafeId}/articles/${postId}?boardtype=L&menuid=${menuId}&referrerAllArticles=false`;
}

function extractBodyTextFromContentHtml(contentHtml) {
  const html = String(contentHtml ?? "").trim();
  if (!html) {
    return "";
  }

  const normalizedHtml = html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "</$1>\n");
  const $ = cheerio.load(normalizedHtml);
  $("script,style,noscript").remove();

  const root = $(".se-main-container").length > 0 ? $(".se-main-container") : $.root();
  return normalizeText(root.text());
}

async function loadCookieHeaderFromStorageState() {
  const storageState = await readJson(config.storageStateFile, null);
  if (!storageState || typeof storageState !== "object") {
    return "";
  }

  const nowSec = Date.now() / 1000;
  const cookies = Array.isArray(storageState.cookies) ? storageState.cookies : [];
  const validCookies = cookies.filter((cookie) => {
    const expires = Number(cookie?.expires);
    if (!Number.isFinite(expires) || expires === -1) {
      return true;
    }
    return expires > nowSec;
  });

  return validCookies
    .map((cookie) => {
      const name = String(cookie?.name ?? "").trim();
      const value = String(cookie?.value ?? "");
      if (!name) {
        return "";
      }
      return `${name}=${value}`;
    })
    .filter(Boolean)
    .join("; ");
}

async function fetchJson(url, options = {}) {
  const timeoutMs = Math.max(1, options.timeoutMs ?? 45_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body,
      signal: controller.signal,
    });

    const rawText = await response.text();
    let payload = null;
    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const messageFromBody =
        payload?.message || payload?.error?.message || payload?.errorMessage || "";
      const message =
        messageFromBody ||
        `HTTP ${response.status} ${response.statusText || ""}`.trim();
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid JSON response");
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

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

function looksLikeLoadingPlaceholder(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return false;
  }

  const compact = normalized.replace(/\s+/g, "");
  return (
    compact.includes("로딩중입니다") ||
    compact.includes("잠시만기다려주세요") ||
    compact.includes("잠시만기다려") ||
    /^loading/i.test(compact)
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

async function ensureAuthenticatedSession(page) {
  if (!config.requireLogin) {
    return;
  }

  // If storage state was restored, prefer that session first.
  // This avoids forcing credential login on every run, which can fail due to 2FA/captcha.
  if (existsSync(config.storageStateFile)) {
    return;
  }

  if (!config.naverId || !config.naverPassword) {
    return;
  }

  const loginEntryUrl =
    `https://nid.naver.com/nidlogin.login?mode=form&url=${encodeURIComponent(config.boardUrl)}`;

  await page.goto(loginEntryUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(800);
  await loginIfNeeded(page);
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

    let bodyText = "";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      bodyText = await pickFirstText(
        frame,
        [
          ".se-main-container",
          "#postContent",
          ".article_viewer",
          ".ContentRenderer",
          ".article_container",
          ".ArticleContentBox",
          "article",
        ],
        {
          retries: 18,
          delayMs: 350,
        }
      );

      if (bodyText && !looksLikeLoadingPlaceholder(bodyText)) {
        break;
      }

      await detailPage.waitForTimeout(500);
    }

    if (looksLikeLoadingPlaceholder(bodyText)) {
      bodyText = "";
    }

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

  const cafeId = extractCafeIdFromBoardUrl(raw);
  if (!cafeId) {
    return "";
  }

  return buildMenuUrl(cafeId, menuId);
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

async function discoverClassMenusViaApi(cafeId) {
  const menusUrl = `https://apis.naver.com/cafe-web/cafe-cafemain-api/v1.0/cafes/${cafeId}/menus`;
  const payload = await fetchJson(menusUrl, {
    headers: buildApiHeaders({ referer: config.boardUrl }),
  });

  const rawMenus = Array.isArray(payload?.result?.menus) ? payload.result.menus : [];
  const discovered = new Map();

  for (const menu of rawMenus) {
    const className = detectClassFromMenuText(menu?.name);
    if (!CLASS_MENU_SET.has(className) || discovered.has(className)) {
      continue;
    }

    const menuId = String(menu?.menuId ?? "").trim();
    if (!menuId) {
      continue;
    }

    const url = buildMenuUrl(cafeId, menuId);
    discovered.set(className, {
      className,
      menuId,
      url: ensureListViewUrl(url),
    });
  }

  if (discovered.size < CLASS_MENU_NAMES.length) {
    for (const className of CLASS_MENU_NAMES) {
      if (discovered.has(className)) {
        continue;
      }

      const fallbackMenuId = DEFAULT_CLASS_MENU_ID_MAP[className];
      const fallbackUrl = buildMenuUrl(cafeId, fallbackMenuId);
      if (!fallbackMenuId || !fallbackUrl) {
        continue;
      }

      discovered.set(className, {
        className,
        menuId: fallbackMenuId,
        url: ensureListViewUrl(fallbackUrl),
      });
    }
  }

  const resolved = CLASS_MENU_NAMES
    .filter((className) => discovered.has(className))
    .map((className) => discovered.get(className));

  if (resolved.length < 1) {
    throw new Error("Failed to discover class menus from API");
  }

  console.log(`[collect] class menus(api): ${resolved.map((item) => item.className).join(", ")}`);
  return resolved;
}

async function getPostLinksViaApi(cafeId, menu, options = {}) {
  const limit = Math.max(1, options.limit ?? config.maxPosts);
  const pageSize = Math.max(15, Math.min(100, limit));
  const listUrl =
    `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${cafeId}/menus/${menu.menuId}/articles` +
    `?page=1&pageSize=${pageSize}&sortBy=TIME&viewType=L`;

  const payload = await fetchJson(listUrl, {
    headers: buildApiHeaders({ referer: menu.url || config.boardUrl }),
  });

  const rawItems = Array.isArray(payload?.result?.articleList) ? payload.result.articleList : [];
  const links = rawItems
    .filter((entry) => entry?.type === "ARTICLE" && entry?.item)
    .map((entry) => entry.item)
    .map((item) => {
      const postId = String(item?.articleId ?? "").trim();
      return {
        postId,
        menuId: String(menu.menuId),
        title: normalizeText(item?.subject || ""),
        author: normalizeText(item?.writerInfo?.nickName || ""),
        publishedAt: formatArticleWriteDate(item?.writeDateTimestamp),
        url: postId ? buildArticleUrl(cafeId, menu.menuId, postId) : "",
      };
    })
    .filter((item) => item.postId && item.url);

  const deduped = uniqueBy(links, (item) => item.postId);
  const prioritized = prioritizeHomeworkLikeLinks(deduped);
  return prioritized.slice(0, limit);
}

async function getPostDetailViaApi(cafeId, post, cookieHeader) {
  if (!cookieHeader) {
    throw loginRequiredError();
  }

  const articleUrl =
    `https://article.cafe.naver.com/gw/v4/cafes/${cafeId}/articles/${post.postId}` +
    `?menuId=${encodeURIComponent(post.menuId || "")}&boardType=L&useCafeId=true&requestFrom=A`;

  const payload = await fetchJson(articleUrl, {
    headers: buildApiHeaders({
      referer: post.url || config.boardUrl,
      cookie: cookieHeader,
    }),
  });

  const article = payload?.result?.article;
  if (!article || typeof article !== "object") {
    throw new Error(`Article payload missing for post ${post.postId}`);
  }

  const bodyText = extractBodyTextFromContentHtml(article.contentHtml);

  return {
    postId: post.postId,
    url: post.url,
    title: normalizeText(article.subject || post.title || ""),
    bodyText,
    publishedAt: normalizeText(
      formatArticleWriteDate(article.writeDate) ||
      post.publishedAt ||
      ""
    ),
    author: normalizeText(article.writer?.nick || post.author || ""),
    className: post.className || "",
    menuId: post.menuId || "",
  };
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

function countByClass(items) {
  const counts = new Map();
  for (const item of items) {
    const key = item?.className || "(empty)";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([className, count]) => `${className}:${count}`)
    .join(", ");
}

async function collectHomeworkPostsViaApi() {
  const cafeId = await resolveCafeIdForCollection();
  if (!cafeId) {
    throw new Error("Failed to resolve cafeId from board URL or storage state");
  }

  const cookieHeader = await loadCookieHeaderFromStorageState();
  if (config.requireLogin && !cookieHeader) {
    throw loginRequiredError();
  }

  const classMenus = await discoverClassMenusViaApi(cafeId);
  const menuPostScanLimit = Math.max(8, config.classPostLimit * 4);

  const linksByClass = [];
  for (const menu of classMenus) {
    try {
      const menuLinks = await getPostLinksViaApi(cafeId, menu, { limit: menuPostScanLimit });
      for (const link of menuLinks) {
        linksByClass.push({
          ...link,
          className: menu.className || "",
          menuId: String(menu.menuId || link.menuId || ""),
        });
      }
    } catch (error) {
      console.error(`[collect] API list failed for ${menu.className}: ${error.message}`);
    }
  }

  const classScopedLinks = uniqueBy(
    linksByClass,
    (item) => `${item.className || ""}:${item.postId}`
  );
  const uniqueLinks = uniqueBy(classScopedLinks, (item) => item.postId);
  console.log(
    `[collect] api class-scoped links=${classScopedLinks.length}, unique posts=${uniqueLinks.length}`
  );
  console.log(`[collect] api class link distribution ${countByClass(classScopedLinks)}`);

  if (config.requireLogin && uniqueLinks.length < 1) {
    throw loginRequiredError();
  }

  const detailedPosts = await mapWithConcurrency(
    uniqueLinks,
    config.detailConcurrency,
    async (link) => {
      try {
        return await getPostDetailViaApi(cafeId, link, cookieHeader);
      } catch (error) {
        console.error(`[collect] API detail failed for post ${link.postId}: ${error.message}`);
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

  console.log(`[collect] api collected post distribution ${countByClass(posts)}`);
  if (config.requireLogin && posts.length < 1) {
    throw loginRequiredError();
  }

  return posts;
}

async function collectHomeworkPostsViaBrowser() {
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

    await ensureAuthenticatedSession(page);

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
    const uniqueLinks = uniqueBy(classScopedLinks, (item) => item.postId);
    console.log(
      `[collect] class-scoped links=${classScopedLinks.length}, unique posts=${uniqueLinks.length}`
    );
    console.log(`[collect] class link distribution ${countByClass(classScopedLinks)}`);

    if (config.requireLogin && uniqueLinks.length < 1) {
      throw loginRequiredError();
    }

    const detailedPosts = await mapWithConcurrency(
      uniqueLinks,
      config.detailConcurrency,
      async (link) => {
        try {
          const detail = await getPostDetail(context, link);
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
    console.log(`[collect] collected post distribution ${countByClass(posts)}`);

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

export async function collectHomeworkPosts() {
  if (!config.boardUrl) {
    throw new Error("Missing required environment variable: NAVER_CAFE_BOARD_URL");
  }

  let apiError = null;
  try {
    const apiPosts = await collectHomeworkPostsViaApi();
    if (apiPosts.length > 0 || !config.requireLogin) {
      console.log("[collect] collector path=http_api");
      return apiPosts;
    }
  } catch (error) {
    apiError = error;
    console.warn(`[collect] http api collector failed: ${error.message}`);
  }

  try {
    const browserPosts = await collectHomeworkPostsViaBrowser();
    console.log("[collect] collector path=browser");
    return browserPosts;
  } catch (browserError) {
    if (apiError) {
      const merged = new Error(
        `Both collectors failed. api=${apiError.message}; browser=${browserError.message}`
      );
      merged.cause = browserError;
      throw merged;
    }
    throw browserError;
  }
}
