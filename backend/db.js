import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "app.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  original_name TEXT NOT NULL,
  source_path TEXT NOT NULL,
  hls_path TEXT,
  poster_path TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  drm_enabled INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

// Add category column if missing (existing databases)
let cols = db.prepare("PRAGMA table_info(videos)").all();
if (!cols.some((c) => c.name === "category")) {
  db.exec("ALTER TABLE videos ADD COLUMN category TEXT NOT NULL DEFAULT ''");
}
if (!cols.some((c) => c.name === "view_count")) {
  db.exec("ALTER TABLE videos ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0");
}

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
`);

const seedCategories = process.env.CATEGORIES || "Tutorials,Marketing,Training,Education,Other";
const defaultNames = seedCategories.split(",").map((s) => s.trim()).filter(Boolean);
const existing = db.prepare("SELECT COUNT(*) AS n FROM categories").get();
if (existing.n === 0) {
  const insert = db.prepare("INSERT INTO categories (name, sort_order) VALUES (?, ?)");
  defaultNames.forEach((name, i) => insert.run(name, i));
}

export default db;
