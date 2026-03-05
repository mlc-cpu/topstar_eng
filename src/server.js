import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

import { config } from "./config.js";

const root = path.resolve(config.outputDir);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
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

const server = http.createServer((req, res) => {
  const filePath = resolveFilePath(req.url || "/");

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
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`[serve] http://localhost:${config.port}`);
  console.log(`[serve] serving from ${root}`);
});
