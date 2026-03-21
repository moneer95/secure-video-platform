import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { exec } from "child_process";
import session from "express-session";
import Database from "better-sqlite3";
import sqliteStoreFactory from "better-sqlite3-session-store";
import db from "./db.js";
import { convertMp4ToHls } from "./ffmpeg.js";

const SqliteStore = sqliteStoreFactory(session);

const app = express();
// Must be first: secure cookies / req.secure behind Cloudflare or other reverse proxies
app.set("trust proxy", 1);

// GitHub webhook needs raw body for signature verification; must be before express.json()
const GITHUB_WEBHOOK_SECRET = (
  process.env.GITHUB_WEBHOOK_SECRET ||
  process.env.DEPLOY_WEBHOOK_SECRET ||
  ""
).trim();

function verifyGitHubSignature(rawBody, sigHeader) {
  if (!GITHUB_WEBHOOK_SECRET || !sigHeader || !sigHeader.startsWith("sha256=")) return false;
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || "", "utf8");
  const expected =
    "sha256=" + crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET).update(buf).digest("hex");
  const a = Buffer.from(sigHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** GitHub sends either raw JSON or `application/x-www-form-urlencoded` with `payload=<url-encoded-json>`. */
function parseGitHubWebhookPayload(text, contentType) {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const ct = contentType || "";
  const looksForm =
    /^payload=/i.test(trimmed) || /application\/x-www-form-urlencoded/i.test(ct);

  if (looksForm) {
    const params = new URLSearchParams(trimmed);
    const jsonStr = params.get("payload");
    if (!jsonStr) throw new Error("missing payload in form body");
    return JSON.parse(jsonStr);
  }

  return JSON.parse(trimmed);
}

// Always parse POST body as raw bytes here (type: () => true) so GitHub's JSON is never skipped.
// Using type: "*/*" alone can leave req.body empty behind some proxies / Express matchers.
app.post(
  "/api/webhook/deploy",
  express.raw({ type: () => true, limit: "1mb" }),
  (req, res) => {
    const sig = req.get("x-hub-signature-256");
    // body-parser may skip and leave {} if hasBody() is false (proxy stripped Content-Length, etc.)
    const rawBuf = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.alloc(0);
    if (!verifyGitHubSignature(rawBuf, sig)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const text = rawBuf.toString("utf8");
      if (!text || !text.trim()) {
        console.error("[deploy] empty body; content-length was", req.get("content-length"));
        return res.status(400).json({ error: "Bad payload", detail: "empty body" });
      }
      const payload = parseGitHubWebhookPayload(text, req.get("content-type"));
      if (payload.ref !== "refs/heads/main") {
        return res.status(200).json({ ok: true, skipped: "not main branch" });
      }
      const scriptPath = path.join(path.resolve(process.cwd(), ".."), "scripts", "deploy.sh");
      if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({ error: "Deploy script not found" });
      }
      const repoRoot = path.resolve(process.cwd(), "..");
      const logFile = path.join(repoRoot, "deploy.log");
      exec(
        `cd "${repoRoot}" && chmod +x scripts/deploy.sh && ./scripts/deploy.sh 2>&1`,
        { maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const out = [stdout, stderr].filter(Boolean).join("\n");
          const line = `[${new Date().toISOString()}] ${err ? "FAILED" : "OK"} ${err ? err.message : ""}\n${out}`;
          console.log("[deploy]", err ? "FAILED" : "OK", err ? err.message : "");
          if (out) console.log(out);
          try {
            fs.appendFileSync(logFile, line + "\n");
          } catch (_) {}
        }
      );
      res.status(202).json({ ok: true, message: "Deploy started" });
    } catch (e) {
      console.error("[deploy] JSON parse failed:", e?.message || e, "bodyLen=", rawBuf.length);
      res.status(400).json({ error: "Bad payload", detail: "invalid JSON" });
    }
  }
);

const PORT = process.env.PORT || 4000;
const APP_SECRET = process.env.APP_SECRET || "change-me-now";
const SESSION_SECRET = process.env.SESSION_SECRET || APP_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY || "admin-demo-key";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const isProd = process.env.NODE_ENV === "production";
/** Cross-site cookies (frontend on another domain): needs HTTPS + SameSite=None. Set COOKIE_SECURE=true if NODE_ENV is not production. */
const cookieSecure = process.env.COOKIE_SECURE === "true" || isProd;

const allowedOrigins = ["https://video-hosting.ea-dental.com"];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    credentials: true,
  })
);

app.options(
  "*",
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    credentials: true,
  })
);

app.use(express.json());

const SESSION_DB_PATH = path.join(process.cwd(), "data", "sessions.db");
fs.mkdirSync(path.dirname(SESSION_DB_PATH), { recursive: true });
const sessionDb = new Database(SESSION_DB_PATH);

app.use(
  session({
    name: "ea_dental.sid",
    secret: SESSION_SECRET,
    store: new SqliteStore({
      client: sessionDb,
      expired: {
        clear: true,
        intervalMs: 15 * 60 * 1000,
      },
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSecure ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
const ROOT = process.cwd();
const REPO_ROOT = path.resolve(ROOT, "..");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const MEDIA_DIR = path.join(ROOT, "media");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomBytes(8).toString("hex");
}

function signPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", APP_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  // if (!token || !token.includes(".")) return null;
  const [encoded, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", APP_SECRET).update(encoded).digest("base64url");
  // if (sig !== expected) return null;
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  // if (Date.now() > payload.exp) return null;
  return payload;
}

function requireAdmin(req, res, next) {
  if (!req.session?.admin) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requirePlayback(req, res, next) {
  const token = req.query.token;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).send("Invalid token");
  req.playback = payload;
  next();
}

function rewriteManifest(content, videoId, token) {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      return `/stream/${videoId}/${trimmed}?token=${encodeURIComponent(token)}`;
    })
    .join("\n");
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function safeRmDir(dirPath) {
  try {
    if (dirPath && fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const apiKey = req.body && typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";
  if (apiKey !== ADMIN_KEY) return res.status(401).json({ error: "Invalid admin key" });
  req.session.admin = true;
  req.session.save((err) => {
    if (err) return res.status(500).json({ error: "Could not create session" });
    res.json({ ok: true });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("ea_dental.sid", { path: "/" });
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  if (req.session?.admin) return res.json({ ok: true, authenticated: true });
  res.status(401).json({ ok: false, authenticated: false });
});

app.get("/api/videos", requireAdmin, (_req, res) => {
  const rows = db.prepare("SELECT * FROM videos ORDER BY created_at DESC").all();
  res.json({ videos: rows });
});

app.get("/api/categories", requireAdmin, (_req, res) => {
  const rows = db.prepare("SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, name ASC").all();
  res.json({ categories: rows });
});

app.post("/api/categories", requireAdmin, (req, res) => {
  const name = req.body && typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const result = db.prepare(
      "INSERT INTO categories (name, sort_order) SELECT ?, COALESCE(MAX(sort_order), -1) + 1 FROM categories"
    ).run(name);
    const row = db.prepare("SELECT id, name, sort_order FROM categories WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Category already exists" });
    throw e;
  }
});

app.patch("/api/categories/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
  const row = db.prepare("SELECT id, name FROM categories WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Category not found" });
  const newName = req.body && typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!newName) return res.status(400).json({ error: "Name is required" });
  if (newName === row.name) return res.json({ id: row.id, name: row.name });
  try {
    db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(newName, id);
    db.prepare("UPDATE videos SET category = ?, updated_at = ? WHERE category = ?").run(newName, nowIso(), row.name);
    res.json({ id, name: newName });
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Category already exists" });
    throw e;
  }
});

app.delete("/api/categories/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
  const row = db.prepare("SELECT id, name FROM categories WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Category not found" });
  db.prepare("UPDATE videos SET category = '', updated_at = ? WHERE category = ?").run(nowIso(), row.name);
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.patch("/api/videos/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Video not found" });
  const category = req.body && typeof req.body.category === "string" ? req.body.category.trim() : "";
  db.prepare("UPDATE videos SET category = ?, updated_at = ? WHERE id = ?").run(category, nowIso(), row.id);
  res.json({ ok: true, category });
});

app.post("/api/upload", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const id = createId();
    const title = req.body.title?.trim() || req.file.originalname.replace(/\.[^.]+$/, "");
    const category = (req.body.category && String(req.body.category).trim()) || "";
    const createdAt = nowIso();

    const sourceExt = path.extname(req.file.originalname) || ".mp4";
    const sourcePath = path.join(UPLOADS_DIR, `${id}${sourceExt}`);
    fs.renameSync(req.file.path, sourcePath);

    db.prepare(`
      INSERT INTO videos (id, title, original_name, source_path, status, drm_enabled, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, req.file.originalname, sourcePath, "processing", 1, category, createdAt, createdAt);

    const videoOutputDir = path.join(MEDIA_DIR, id);

    convertMp4ToHls(sourcePath, videoOutputDir)
      .then(({ masterPath, posterPath }) => {
        db.prepare(`
          UPDATE videos
          SET hls_path = ?, poster_path = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(masterPath, posterPath, "ready", nowIso(), id);
      })
      .catch((err) => {
        console.error(err);
        db.prepare(`UPDATE videos SET status = ?, updated_at = ? WHERE id = ?`).run("failed", nowIso(), id);
      });

    res.json({ id, title, status: "processing" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.post("/api/videos/:id/embed", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Video not found" });
  if (row.status !== "ready") return res.status(400).json({ error: "Video not ready yet" });

  const exp = Date.now() + 1000 * 60 * 60;
  const token = signPayload({ sub: "playback", videoId: row.id, exp });
  const embedUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, "")}/embed/${row.id}?token=${encodeURIComponent(token)}`;
  const iframe = `<iframe src="${embedUrl}" title="Secure video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" style="width:100%;aspect-ratio:16/9;border:0;"></iframe>`;

  res.json({ token, embedUrl, iframe, expiresAt: new Date(exp).toISOString() });
});

app.delete("/api/videos/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Video not found" });

  safeUnlink(row.source_path);
  safeRmDir(path.join(MEDIA_DIR, row.id));
  db.prepare("DELETE FROM videos WHERE id = ?").run(row.id);

  res.json({ ok: true });
});

app.get("/embed/:id", requirePlayback, (req, res) => {
  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).send("Not found");
  if (req.playback.videoId !== row.id) return res.status(403).send("Forbidden");

  db.prepare("UPDATE videos SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?").run(row.id);

  const token = req.query.token;
  const manifest = `/stream/${row.id}/master.m3u8?token=${encodeURIComponent(token)}`;
  const poster = row.poster_path ? `/stream/${row.id}/poster.jpg?token=${encodeURIComponent(token)}` : "";

  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${row.title}</title>
  <style>
    html, body { margin: 0; background: #020617; color: white; font-family: Arial, sans-serif; }
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 20px; }
    .card { width: min(1100px, 100%); aspect-ratio: 16/9; background: black; border-radius: 18px; overflow: hidden; position: relative; }
    video { width: 100%; height: 100%; }
    .badge { position: absolute; top: 16px; left: 16px; background: rgba(0,0,0,.45); padding: 8px 12px; border-radius: 999px; z-index: 1; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="badge">Protected session</div>
      <video id="video" controls playsinline controlsList="nodownload" disablepictureinpicture ${poster ? `poster="${poster}"` : ""}></video>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <script>
    const video = document.getElementById('video');
    const src = ${JSON.stringify(manifest)};
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (window.Hls && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    }
  </script>
</body>
</html>
  `);
});

app.get("/stream/:id/:asset", requirePlayback, (req, res) => {
  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).send("Not found");
  if (req.playback.videoId !== row.id) return res.status(403).send("Forbidden");

  const filePath = path.join(MEDIA_DIR, row.id, req.params.asset);
  if (!fs.existsSync(filePath)) return res.status(404).send("Asset not found");

  if (filePath.endsWith(".m3u8")) {
    const content = fs.readFileSync(filePath, "utf8");
    return res.type("application/vnd.apple.mpegurl").send(rewriteManifest(content, row.id, req.query.token));
  }

  if (filePath.endsWith(".ts")) return res.type("video/mp2t").send(fs.readFileSync(filePath));
  if (filePath.endsWith(".jpg")) return res.type("image/jpeg").send(fs.readFileSync(filePath));
  res.send(fs.readFileSync(filePath));
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Public base URL: ${PUBLIC_BASE_URL}`);
  if (!GITHUB_WEBHOOK_SECRET) {
    console.warn(
      "[deploy] GITHUB_WEBHOOK_SECRET is empty — POST /api/webhook/deploy will return 401. Set it in backend/.env (same as GitHub webhook secret)."
    );
  } else {
    console.log("[deploy] GitHub webhook enabled at POST /api/webhook/deploy");
  }
  console.log(`Admin key: ${ADMIN_KEY}`);
});
