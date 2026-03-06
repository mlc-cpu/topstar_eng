import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

import { config } from "./config.js";
import { runSync } from "./main.js";
import { readJson } from "./utils.js";

const root = path.resolve(config.outputDir);
let refreshInFlight = null;
const AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000;
const AUTO_SYNC_INITIAL_DELAY_MS = 15 * 1000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function resolveFilePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = cleanPath === "/" ? "/index.html" : cleanPath;
  const absolutePath = path.resolve(root, `.${relativePath}`);

  if (!absolutePath.startsWith(root)) {
    return null;
  }

  return absolutePath;
}

function writeJsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
  });
  res.end(JSON.stringify(payload));
}

function getErrorMessage(error) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return String(error || "unknown_error");
}

function startRefreshTask(options) {
  refreshInFlight = runSync(options)
    .catch((error) => {
      const message = getErrorMessage(error);
      console.error(`[sync] ${options.trigger || "unknown"} failed: ${message}`);
      return {
        status: "refresh_failed",
        skipped: true,
        reason: "error",
        error: message,
        trigger: options.trigger || null,
        syncedAt: null,
      };
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function runScheduledRefreshTick() {
  if (refreshInFlight) {
    console.log("[sync] scheduled tick skipped (refresh in flight)");
    return;
  }

  await startRefreshTask({
    trigger: "scheduled",
    force: false,
    scheduled: true,
  });
}

function startAutoRefreshLoop() {
  const run = () => {
    runScheduledRefreshTick().catch((error) => {
      console.error(`[sync] scheduled tick failed: ${getErrorMessage(error)}`);
    });
  };

  setTimeout(run, AUTO_SYNC_INITIAL_DELAY_MS);
  setInterval(run, AUTO_SYNC_INTERVAL_MS);
}

async function handleRefreshRequest(url, res) {
  const force = url.searchParams.get("force") === "1";

  if (refreshInFlight) {
    const inFlightResult = await refreshInFlight;
    writeJsonResponse(res, 200, {
      ok: true,
      inFlight: true,
      ...inFlightResult,
    });
    return;
  }

  refreshInFlight = startRefreshTask({
    trigger: "manual",
    force,
    scheduled: false,
  });

  const result = await refreshInFlight;
  writeJsonResponse(res, 200, {
    ok: true,
    inFlight: false,
    ...result,
  });
}

async function handleStatusRequest(res) {
  const state = (await readJson(config.stateFile, {})) || {};
  writeJsonResponse(res, 200, {
    ok: true,
    syncedAt: state.syncedAt || null,
    lastTrigger: state.lastTrigger || null,
    refreshInFlight: Boolean(refreshInFlight),
    refreshCooldownSeconds: config.refreshCooldownSeconds,
    quietHours: {
      start: config.quietHoursStart,
      end: config.quietHoursEnd,
      timeZone: config.timeZone,
    },
  });
}

async function handleApiRequest(req, res, url) {
  if (url.pathname === "/api/status") {
    if (req.method !== "GET") {
      writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
      return true;
    }

    await handleStatusRequest(res);
    return true;
  }

  if (url.pathname === "/api/refresh") {
    if (req.method !== "POST" && req.method !== "GET") {
      writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
      return true;
    }

    await handleRefreshRequest(url, res);
    return true;
  }

  return false;
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (await handleApiRequest(req, res, requestUrl)) {
    return;
  }

  const filePath = resolveFilePath(requestUrl.pathname || "/");

  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const stat = statSync(filePath);
  if (stat.isDirectory()) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  const headers = {
    "content-type": contentType,
  };

  if (ext === ".json") {
    headers["cache-control"] = "no-store, max-age=0";
  }

  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(`[serve] request failed: ${error.stack || error.message}`);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ ok: false, error: "Internal Server Error" }));
  });
});

startAutoRefreshLoop();

server.listen(config.port, "0.0.0.0", () => {
  console.log(`[serve] http://localhost:${config.port}`);
  console.log(`[serve] serving from ${root}`);
  console.log(
    `[sync] auto refresh every ${Math.round(AUTO_SYNC_INTERVAL_MS / 60_000)}m (quiet hours ${config.quietHoursStart}:00-${config.quietHoursEnd}:00 ${config.timeZone})`
  );
});
