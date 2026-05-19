import { fileURLToPath } from "node:url";
import path from "node:path";

import { config } from "./config.js";
import { readJson } from "./utils.js";

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const validationConfig = {
  minGeneratedPosts: Math.max(0, toInt(process.env.MIN_GENERATED_POSTS, 1)),
  minMatchedClasses: Math.max(0, toInt(process.env.MIN_MATCHED_CLASSES, 1)),
  maxGeneratedAgeMinutes: Math.max(0, toInt(process.env.MAX_GENERATED_AGE_MINUTES, 0)),
};

function parseArgs(argv) {
  const options = {
    file: config.dataFile,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--file" && argv[index + 1]) {
      options.file = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function pushIssue(issues, message) {
  issues.push(message);
}

function validatePost(post, index, issues) {
  const prefix = `posts[${index}]`;
  if (!post || typeof post !== "object") {
    pushIssue(issues, `${prefix} must be an object`);
    return;
  }

  for (const field of ["postId", "title", "url", "className"]) {
    if (!String(post[field] ?? "").trim()) {
      pushIssue(issues, `${prefix}.${field} is required`);
    }
  }

  if (!Array.isArray(post.items) || post.items.length < 1) {
    pushIssue(issues, `${prefix}.items must contain at least one item`);
    return;
  }

  post.items.forEach((item, itemIndex) => {
    if (!item || typeof item !== "object") {
      pushIssue(issues, `${prefix}.items[${itemIndex}] must be an object`);
      return;
    }

    if (!String(item.id ?? "").trim()) {
      pushIssue(issues, `${prefix}.items[${itemIndex}].id is required`);
    }

    if (!String(item.text ?? "").trim()) {
      pushIssue(issues, `${prefix}.items[${itemIndex}].text is required`);
    }
  });
}

export async function validateHomeworkData(filePath = config.dataFile, now = new Date()) {
  const issues = [];
  const payload = await readJson(filePath, null);

  if (!payload || typeof payload !== "object") {
    pushIssue(issues, "payload must be a JSON object");
    return { ok: false, issues, summary: null };
  }

  const generatedAt = new Date(payload.generatedAt);
  if (!payload.generatedAt || Number.isNaN(generatedAt.getTime())) {
    pushIssue(issues, "generatedAt must be a valid ISO date");
  } else {
    const futureSkewMs = generatedAt.getTime() - now.getTime();
    if (futureSkewMs > 5 * 60 * 1000) {
      pushIssue(issues, "generatedAt is more than 5 minutes in the future");
    }

    if (validationConfig.maxGeneratedAgeMinutes > 0) {
      const ageMs = now.getTime() - generatedAt.getTime();
      const maxAgeMs = validationConfig.maxGeneratedAgeMinutes * 60 * 1000;
      if (ageMs > maxAgeMs) {
        pushIssue(
          issues,
          `generatedAt is older than ${validationConfig.maxGeneratedAgeMinutes} minutes`
        );
      }
    }
  }

  if (!payload.source || typeof payload.source !== "object") {
    pushIssue(issues, "source metadata is required");
  } else if (!String(payload.source.boardUrl ?? "").trim()) {
    pushIssue(issues, "source.boardUrl is required");
  }

  const posts = Array.isArray(payload.posts) ? payload.posts : null;
  if (!posts) {
    pushIssue(issues, "posts must be an array");
  } else {
    if (posts.length < validationConfig.minGeneratedPosts) {
      pushIssue(
        issues,
        `posts length ${posts.length} is below MIN_GENERATED_POSTS=${validationConfig.minGeneratedPosts}`
      );
    }

    posts.forEach((post, index) => validatePost(post, index, issues));

    const classCount = new Set(
      posts.map((post) => String(post?.className ?? "").trim()).filter(Boolean)
    ).size;
    if (classCount < validationConfig.minMatchedClasses) {
      pushIssue(
        issues,
        `matched class count ${classCount} is below MIN_MATCHED_CLASSES=${validationConfig.minMatchedClasses}`
      );
    }
  }

  return {
    ok: issues.length < 1,
    issues,
    summary: {
      generatedAt: payload.generatedAt || "",
      allPostCount: Number(payload.allPostCount ?? 0),
      filteredPostCount: Number(payload.filteredPostCount ?? 0),
      matchedClassCount: Number(payload.matchedClassCount ?? 0),
      postCount: Array.isArray(payload.posts) ? payload.posts.length : 0,
    },
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
  const options = parseArgs(process.argv.slice(2));
  validateHomeworkData(options.file)
    .then((result) => {
      if (!result.ok) {
        for (const issue of result.issues) {
          console.error(`[validate] ${issue}`);
        }
        process.exit(1);
      }

      console.log(
        `[validate] ok: generatedAt=${result.summary.generatedAt}, posts=${result.summary.postCount}, classes=${result.summary.matchedClassCount}`
      );
    })
    .catch((error) => {
      console.error(`[validate] failed: ${error.stack || error.message}`);
      process.exit(1);
    });
}
