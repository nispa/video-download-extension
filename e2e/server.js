import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const TYPES = {
  ".html": "text/html",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".mpd": "application/dash+xml",
  ".ts": "video/mp2t",
  ".m4s": "video/iso.segment",
};
/** A direct file just above the engine's minimum size (512 KB): its content does not matter. */
const CLIP_BYTES = 600 * 1024;

/**
 * Serves the fixtures plus a synthetic /clip.mp4, and records the Referer and
 * Origin of every request, to check what the extension sends.
 * @returns {Promise<{ url: string, requests: object[], close: () => Promise<void> }>}
 */
export async function startServer() {
  const requests = [];
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(request.url.split("?")[0]);
    requests.push({
      path,
      referer: request.headers.referer ?? "",
      origin: request.headers.origin ?? "",
    });
    if (path === "/clip.mp4") {
      response.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": CLIP_BYTES });
      response.end(Buffer.alloc(CLIP_BYTES));
      return;
    }
    try {
      const body = await readFile(join(FIXTURES, path === "/" ? "page.html" : path));
      response.writeHead(200, {
        "Content-Type": TYPES[extname(path)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
