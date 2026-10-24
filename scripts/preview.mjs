import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("out");
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (base) {
      if (!pathname.startsWith(base + "/") && pathname !== base)
        throw new Error();
      pathname = pathname.slice(base.length);
    }
    let path = resolve(root, "." + pathname);
    if (path !== root && !path.startsWith(root + sep)) throw new Error();
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    const bytes = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}).listen(3000, "127.0.0.1", () =>
  console.log(`Local: http://localhost:3000${base}/`),
);
