import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export async function ensureDirForFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

export async function writeJson(filePath, value) {
  await ensureDirForFile(filePath);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function writeText(filePath, value) {
  await ensureDirForFile(filePath);
  await fs.writeFile(filePath, value, "utf8");
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CLASS_ALIAS_MAP = {
  ace: "Ace",
  star: "Star",
  top: "Top",
  peak: "Peak",
  champ: "Champion",
  champion: "Champion",
  radiant: "Radiant",
};

function normalizeClassToken(value) {
  return String(value ?? "")
    .replaceAll("☆", " ")
    .replaceAll("★", " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeClassName(value) {
  const cleaned = normalizeClassToken(value);
  if (!cleaned) {
    return "";
  }

  const compact = cleaned.toLowerCase().replace(/\s+/g, "");
  return CLASS_ALIAS_MAP[compact] || cleaned;
}

export function extractClassNameFromTitle(title) {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) {
    return "";
  }

  const homeworkPattern = /^(.+?)\s*반\s*숙제/i;
  const homeworkMatch = normalizedTitle.match(homeworkPattern);
  if (homeworkMatch?.[1]) {
    return canonicalizeClassName(homeworkMatch[1]);
  }

  for (const separator of ["//", "|", "｜"]) {
    const separatorIndex = normalizedTitle.indexOf(separator);
    if (separatorIndex > -1) {
      const candidate = normalizedTitle.slice(0, separatorIndex);
      const className = canonicalizeClassName(candidate);
      if (className) {
        return className;
      }
    }
  }

  return "";
}

export function buildItemId(seed) {
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 12);
}

export function extractPostId(url) {
  if (!url) {
    return "";
  }

  const text = String(url);
  const patterns = [/\/articles\/(\d+)/i, /articleid=(\d+)/i, /goArticle\((\d+)\)/i];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

export function toAbsoluteNaverUrl(href) {
  if (!href) {
    return "";
  }

  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  if (href.startsWith("/")) {
    return `https://cafe.naver.com${href}`;
  }

  if (href.startsWith("cafe.naver.com")) {
    return `https://${href}`;
  }

  if (href.startsWith("javascript:goArticle(")) {
    const postId = extractPostId(href);
    return postId ? `https://cafe.naver.com/ca-fe/cafes/articles/${postId}` : "";
  }

  return `https://cafe.naver.com/${href}`;
}

export function extractChecklistItems(rawText) {
  const text = normalizeText(rawText);
  if (!text) {
    return [];
  }

  const lines = text.split("\n").map((line) => line.trim());
  const bulletPattern = /^(?:[-*+]|[•●◦▪]|\[[xX ]\]|\d+[.)])\s+/;

  const checklist = lines
    .filter((line) => line.length > 1)
    .filter((line) => bulletPattern.test(line) || line.includes("숙제") || line.includes("Homework"))
    .map((line) => line.replace(bulletPattern, "").trim())
    .map((line) => line.replace(/^숙제\s*[:：]\s*/i, "").trim())
    .filter((line) => line.length > 1);

  if (checklist.length > 0) {
    return uniqueBy(checklist, (line) => line.toLowerCase()).slice(0, 30);
  }

  const fallback = lines.filter((line) => line.length > 2).slice(0, 10);
  return uniqueBy(fallback, (line) => line.toLowerCase());
}

function buildUtcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function parseDatePartsFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const ymdPattern = /(20\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/;
  const ymdMatch = normalized.match(ymdPattern);
  if (ymdMatch) {
    return {
      year: Number.parseInt(ymdMatch[1], 10),
      month: Number.parseInt(ymdMatch[2], 10),
      day: Number.parseInt(ymdMatch[3], 10),
    };
  }

  const monthMap = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };

  const englishPattern =
    /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*,?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s*(20\d{2})/i;
  const englishMatch = normalized.match(englishPattern);
  if (englishMatch) {
    return {
      year: Number.parseInt(englishMatch[3], 10),
      month: monthMap[englishMatch[1].toLowerCase()],
      day: Number.parseInt(englishMatch[2], 10),
    };
  }

  const nativeDate = new Date(normalized);
  if (!Number.isNaN(nativeDate.getTime())) {
    return {
      year: nativeDate.getUTCFullYear(),
      month: nativeDate.getUTCMonth() + 1,
      day: nativeDate.getUTCDate(),
    };
  }

  return null;
}

export function parseDateFromText(text) {
  const parts = parseDatePartsFromText(text);
  if (!parts) {
    return null;
  }

  const { year, month, day } = parts;
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = buildUtcDate(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateKey(date, timeZone = "Asia/Seoul") {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function dateKeyToUtcMs(dateKey) {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  return Date.UTC(year, month - 1, day, 0, 0, 0);
}

export function isWithinRecentDays(date, days, now = new Date(), timeZone = "Asia/Seoul") {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }

  const itemKey = toDateKey(date, timeZone);
  const nowKey = toDateKey(now, timeZone);
  if (!itemKey || !nowKey) {
    return false;
  }

  const diffDays = (dateKeyToUtcMs(nowKey) - dateKeyToUtcMs(itemKey)) / 86_400_000;
  return diffDays >= 0 && diffDays < days;
}

export function derivePostDate(post) {
  const candidates = [
    post?.publishedAt,
    post?.title,
    normalizeText(post?.bodyText).split("\n").slice(0, 6).join(" "),
  ];

  for (const candidate of candidates) {
    const parsed = parseDateFromText(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
