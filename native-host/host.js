import { execFile, spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { createMessageReader, encodeMessage } from "./protocol.js";
import { buildArgs, parseOutputLine } from "./ytdlpArgs.js";

// Native messaging host of Video Grabber: the browser starts one process per
// request; it runs yt-dlp and reports back. Registered by install.ps1.

const OUTPUT_DIR = process.env.VIDEO_GRABBER_OUTDIR || join(homedir(), "Downloads");
const YTDLP_ENV = { ...process.env, PYTHONIOENCODING: "utf-8" };

let child = null;
let stdinClosed = false;
let pendingChecks = 0;

const send = (message) =>
  new Promise((resolve) => process.stdout.write(encodeMessage(message), resolve));
const runYtdlp = (args) => spawn("yt-dlp", args, { windowsHide: true, env: YTDLP_ENV });
const exitIfIdle = () => {
  if (stdinClosed && pendingChecks === 0 && child === null) process.exit(0);
};

function check() {
  pendingChecks++;
  let output = "";
  let replied = false;
  // "error" and "close" can both fire: answer once.
  const reply = async (message) => {
    if (replied) return;
    replied = true;
    await send(message);
    pendingChecks--;
    exitIfIdle();
  };
  const proc = runYtdlp(["--version"]);
  proc.stdout.on("data", (data) => (output += data));
  proc.on("error", (error) =>
    reply({ type: "check", ok: false, error: error.code ?? error.message }),
  );
  proc.on("close", (code) => {
    if (code === 0) reply({ type: "check", ok: true, version: output.trim() });
    else reply({ type: "check", ok: false, error: `yt-dlp exited with code ${code}` });
  });
}

function download(url, format) {
  let file = "";
  let lastError = "";
  child = runYtdlp(buildArgs(url, format, OUTPUT_DIR));
  const onLine = (line) => {
    const parsed = parseOutputLine(line);
    if (parsed?.kind === "message") send(parsed.message);
    else if (parsed?.kind === "file") file = parsed.file;
    else if (parsed?.kind === "error") lastError = parsed.error;
  };
  for (const stream of [child.stdout, child.stderr]) readLines(stream, onLine);
  child.on(
    "error",
    (error) => (lastError = `cannot start yt-dlp (${error.code ?? error.message})`),
  );
  child.on("close", async (code) => {
    child = null;
    if (code === 0) await send({ type: "done", file });
    else await send({ type: "error", message: lastError || `yt-dlp exited with code ${code}` });
    process.exit(0); // one process per download
  });
}

function readLines(stream, onLine) {
  let rest = "";
  stream.setEncoding("utf8");
  stream.on("data", (data) => {
    const lines = (rest + data).split(/\r?\n/);
    rest = lines.pop();
    lines.forEach(onLine);
  });
  stream.on("end", () => rest && onLine(rest));
}

/** Stops yt-dlp and, on Windows, the ffmpeg it started. */
function stopChild() {
  if (process.platform === "win32")
    execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
  else child.kill("SIGTERM");
}

process.stdin.on(
  "data",
  createMessageReader((message) => {
    if (message?.type === "check") check();
    else if (message?.type === "download" && /^https?:\/\//i.test(message.url))
      download(message.url, message.format);
    else send({ type: "error", message: "Invalid request" });
  }),
);

// The extension closed the connection: a download still running was cancelled.
process.stdin.on("end", () => {
  stdinClosed = true;
  if (child) {
    stopChild();
    process.exit(0);
  }
  exitIfIdle();
});
