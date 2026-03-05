import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { chromium } from "playwright";

import { config } from "./config.js";
import { ensureDirForFile, writeJson } from "./utils.js";

async function runManualLogin() {
  if (!config.boardUrl) {
    throw new Error("Missing required environment variable: NAVER_CAFE_BOARD_URL");
  }

  await ensureDirForFile(config.storageStateFile);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(config.boardUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

    console.log("[login] 브라우저에서 네이버 카페 로그인을 완료하세요.");
    console.log("[login] 로그인 후 게시판 페이지가 열리면 터미널에서 Enter를 누르세요.");

    const rl = readline.createInterface({ input, output });
    await rl.question("");
    rl.close();

    const state = await context.storageState();
    await writeJson(config.storageStateFile, state);

    console.log(`[login] saved storage state -> ${config.storageStateFile}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

runManualLogin().catch((error) => {
  console.error(`[login] failed: ${error.stack || error.message}`);
  process.exit(1);
});
