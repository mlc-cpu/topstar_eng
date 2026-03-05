import dotenv from "dotenv";

dotenv.config();

function toBool(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  naverId: process.env.NAVER_ID?.trim() ?? "",
  naverPassword: process.env.NAVER_PASSWORD?.trim() ?? "",
  boardUrl: process.env.NAVER_CAFE_BOARD_URL?.trim() ?? "",
  headless: toBool(process.env.HEADLESS, true),
  requireLogin: toBool(process.env.REQUIRE_LOGIN, true),
  maxPosts: toInt(process.env.MAX_POSTS, 80),
  detailConcurrency: Math.min(8, Math.max(1, toInt(process.env.DETAIL_CONCURRENCY, 4))),
  classPostLimit: Math.max(1, toInt(process.env.CLASS_POST_LIMIT, 2)),
  homeworkAuthor: process.env.HOMEWORK_AUTHOR?.trim() || "그래그래그레이스",
  port: toInt(process.env.PORT, 4173),
  timeZone: process.env.TIME_ZONE?.trim() || "Asia/Seoul",
  pageTitle: process.env.PAGE_TITLE?.trim() || "TopStar 영어학원 숙제 체크리스트",
  outputDir: process.env.OUTPUT_DIR?.trim() || "./public",
  dataFile: process.env.DATA_FILE?.trim() || "./public/homework.json",
  htmlFile: process.env.HTML_FILE?.trim() || "./public/index.html",
  stateFile: process.env.STATE_FILE?.trim() || "./.state/run-state.json",
  storageStateFile:
    process.env.STORAGE_STATE_FILE?.trim() || "./.state/naver-storage-state.json",
  appLogoFile: process.env.APP_LOGO_FILE?.trim() || "./assets/topstar-logo.png",
  pagesUrl: process.env.PAGES_URL?.trim() || "https://mlc-cpu.github.io/topstar_eng/",
  shortUrl: process.env.SHORT_URL?.trim() || "https://is.gd/qDMgMU",
};
