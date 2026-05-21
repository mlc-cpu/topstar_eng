import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function getChangedDocsFiles() {
  return git(["diff", "--name-only", "--", "docs"])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readJsonFromHead(filePath) {
  try {
    return JSON.parse(git(["show", `HEAD:${filePath}`]));
  } catch {
    return null;
  }
}

function readJsonFromWorktree(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizedHomeworkPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const normalized = JSON.parse(JSON.stringify(payload));
  delete normalized.generatedAt;
  return normalized;
}

const changedFiles = getChangedDocsFiles();
if (changedFiles.length < 1) {
  console.log("no docs changes detected");
  process.exit(1);
}

const nonHomeworkJsonChanges = changedFiles.filter((filePath) => filePath !== "docs/homework.json");
if (nonHomeworkJsonChanges.length > 0) {
  console.log(`publishing docs because static assets changed: ${nonHomeworkJsonChanges.join(", ")}`);
  process.exit(0);
}

if (!changedFiles.includes("docs/homework.json")) {
  console.log("no publishable docs changes detected");
  process.exit(1);
}

const beforePayload = normalizedHomeworkPayload(readJsonFromHead("docs/homework.json"));
const afterPayload = normalizedHomeworkPayload(readJsonFromWorktree("docs/homework.json"));
if (!beforePayload || !afterPayload) {
  console.log("publishing docs because homework payload could not be compared safely");
  process.exit(0);
}

if (JSON.stringify(beforePayload) === JSON.stringify(afterPayload)) {
  console.log("homework content unchanged; generatedAt-only update skipped");
  process.exit(1);
}

console.log("publishing docs because homework content changed");
process.exit(0);
