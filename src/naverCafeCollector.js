import { existsSync } from "node:fs";

import { chromium } from "playwright";

import { config } from "./config.js";
import {
  extractClassNameFromTitle,
  extractPostId,
  normalizeText,
  toAbsoluteNaverUrl,
  uniqueBy,
  writeJson,
} from "./utils.js";

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

async function getPostLinks(frame) {
  const rawLinks = await frame.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));

    return anchors
      .map((anchor) => {
        const href = anchor.getAttribute("href") || "";
        const title = (anchor.textContent || "").trim();
        return { href, title };
      })
      .filter((item) => {
        const href = item.href || "";
        return (
          href.includes("/articles/") ||
          href.includes("ArticleRead.nhn") ||
          href.includes("articleid=") ||
          href.includes("javascript:goArticle(")
        );
      });
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
  return prioritized.slice(0, config.maxPosts);
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
    };
  } finally {
    await detailPage.close();
  }
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

    const links = await getPostLinks(frame);
    if (config.requireLogin && links.length < 1) {
      throw loginRequiredError();
    }

    const detailedPosts = await mapWithConcurrency(
      links,
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
    const posts = detailedPosts.filter(Boolean);

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
