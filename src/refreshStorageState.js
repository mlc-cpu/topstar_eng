import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { config } from "./config.js";
import { ensureDirForFile, writeJson } from "./utils.js";

function hasCredentialLoginConfig() {
  return Boolean(config.naverId && config.naverPassword);
}

async function pageLooksLikeLoginGate(page) {
  if (/nidlogin\.login/i.test(page.url())) {
    return true;
  }

  try {
    const text = await page.evaluate(() => (document.body?.innerText || "").slice(0, 3000));
    return /로그인|아이디|비밀번호/i.test(text);
  } catch {
    return false;
  }
}

async function loginWithCredentials(page) {
  if (!hasCredentialLoginConfig()) {
    throw new Error(
      "storage state refresh requires a valid existing session or NAVER_ID/NAVER_PASSWORD"
    );
  }

  const loginEntryUrl =
    `https://nid.naver.com/nidlogin.login?mode=form&url=${encodeURIComponent(config.boardUrl)}`;

  await page.goto(loginEntryUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await page.fill("input#id", config.naverId);
  await page.fill("input#pw", config.naverPassword);

  const loginButton = page.locator("button.btn_login, input.btn_login").first();
  await loginButton.click();
  await page.waitForTimeout(3000);

  if (await pageLooksLikeLoginGate(page)) {
    throw new Error(
      "Naver credential login did not complete during storage state refresh"
    );
  }
}

export async function refreshStorageState() {
  if (!config.boardUrl) {
    throw new Error("Missing required environment variable: NAVER_CAFE_BOARD_URL");
  }

  await ensureDirForFile(config.storageStateFile);

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
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);

    if (config.requireLogin && (await pageLooksLikeLoginGate(page))) {
      console.warn("[refresh-session] existing session reached login gate; trying credentials");
      await loginWithCredentials(page);
      await page.goto(config.boardUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.waitForTimeout(1500);
    }

    if (config.requireLogin && (await pageLooksLikeLoginGate(page))) {
      throw new Error("Naver login gate still visible after storage state refresh");
    }

    await writeJson(config.storageStateFile, await context.storageState());
    console.log(`[refresh-session] saved storage state -> ${config.storageStateFile}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  const currentFilePath = fileURLToPath(import.meta.url);
  return path.resolve(process.argv[1]) === currentFilePath;
}

if (isDirectExecution()) {
  refreshStorageState().catch((error) => {
    console.error(`[refresh-session] failed: ${error.stack || error.message}`);
    process.exit(1);
  });
}
