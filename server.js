require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const SESSION_SECRET = process.env.SESSION_SECRET || "philia-host-dev-secret-change-me";

const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, "philiahost.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insertMessage = db.prepare(`
  INSERT INTO messages (name, email, phone, subject, message)
  VALUES (@name, @email, @phone, @subject, @message)
`);

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: "philiahost.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// ---- Public site (only files inside public/ are ever served) ----
app.use(express.static(publicDir, { extensions: ["html"] }));

// ---- Public API ----
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
}

app.post("/api/contact", (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: "name_required" });
  if (!isValidEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
  if (!message || !message.trim()) return res.status(400).json({ ok: false, error: "message_required" });

  insertMessage.run({
    name: name.trim().slice(0, 200),
    email: email.trim().slice(0, 200),
    phone: (phone || "").trim().slice(0, 50),
    subject: (subject || "").trim().slice(0, 200),
    message: message.trim().slice(0, 5000),
  });

  res.json({ ok: true });
});

// ---- Admin auth (session cookie, no third-party service needed) ----
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ ok: false, error: "unauthorized" });
  return res.redirect("/admin/login");
}

app.get("/admin/login", (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect("/admin");
  res.sendFile(path.join(__dirname, "admin-login.html"));
});

app.post("/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect("/admin");
  }
  res.redirect("/admin/login?error=1");
});

app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/api/admin/messages", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
  res.json({ ok: true, messages: rows });
});

app.listen(PORT, () => {
  console.log(`Philia Host site + backend running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
