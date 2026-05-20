const path = require('path')
const fs = require('fs')
const { app } = require('electron')

// In dev: store data next to the project. In packaged builds: use the OS
// user-data directory so data survives app updates and lives outside Program Files.
const DATA_DIR = app.isPackaged
  ? app.getPath('userData')
  : path.join(__dirname, '..', 'data')

const DB_PATH = path.join(DATA_DIR, 'golem.db')
const MEMORY_PATH = path.join(DATA_DIR, 'memory.txt')

fs.mkdirSync(DATA_DIR, { recursive: true })

let db = null

async function init() {
  const initSqlJs = require('sql.js')
  // sql.js WASM is unpacked from the asar archive in packaged builds.
  const wasmDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist')
    : path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist')
  const SQL = await initSqlJs({ locateFile: file => path.join(wasmDir, file) })

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS project_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      pinned INTEGER DEFAULT 0,
      sigil_id INTEGER,
      project_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('system','user','assistant')),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_proj_files ON project_files(project_id);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sigils (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER,
      model TEXT NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      ttft_ms INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_date ON telemetry(created_at);
  `)

  // Migrations for existing DBs (safe — fails silently if column already exists)
  try { db.run('ALTER TABLE conversations ADD COLUMN pinned INTEGER DEFAULT 0') } catch {}
  try { db.run('ALTER TABLE conversations ADD COLUMN sigil_id INTEGER') } catch {}
  try { db.run('ALTER TABLE conversations ADD COLUMN project_id INTEGER') } catch {}

  persist()
}

function persist() {
  if (!db) return
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
}

function run(sql, params = []) {
  db.run(sql, params)
  persist()
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function get(sql, params = []) {
  return all(sql, params)[0] ?? null
}

function insert(sql, params = []) {
  db.run(sql, params)
  const row = get('SELECT last_insert_rowid() as id')
  persist()
  return row?.id ?? null
}

// ── Projects ──────────────────────────────────────────────────────────────────

function listProjects() {
  return all('SELECT * FROM projects ORDER BY name ASC')
}

function createProject(name) {
  return insert('INSERT INTO projects (name) VALUES (?)', [name])
}

function renameProject(id, name) {
  run('UPDATE projects SET name = ? WHERE id = ?', [name, id])
}

function deleteProject(id) {
  run('DELETE FROM projects WHERE id = ?', [id])
}

function listProjectFiles(projectId) {
  return all('SELECT * FROM project_files WHERE project_id = ? ORDER BY name ASC', [projectId])
}

function addProjectFile(projectId, name, content) {
  return insert('INSERT INTO project_files (project_id, name, content) VALUES (?, ?, ?)', [projectId, name, content])
}

function removeProjectFile(id) {
  run('DELETE FROM project_files WHERE id = ?', [id])
}

// ── Conversations ─────────────────────────────────────────────────────────────

const CONV_SELECT = `
  SELECT c.*, s.name as sigil_name
  FROM conversations c
  LEFT JOIN sigils s ON c.sigil_id = s.id
`

function listConversations() {
  return all(`${CONV_SELECT} WHERE c.project_id IS NULL ORDER BY c.pinned DESC, c.updated_at DESC`)
}

function listProjectConversations(projectId) {
  return all(`${CONV_SELECT} WHERE c.project_id = ? ORDER BY c.pinned DESC, c.updated_at DESC`, [projectId])
}

function getConversation(id) {
  return get(`${CONV_SELECT} WHERE c.id = ?`, [id])
}

function createConversation(title, model, sigilId = null, projectId = null) {
  return insert(
    'INSERT INTO conversations (title, model, sigil_id, project_id) VALUES (?, ?, ?, ?)',
    [title, model, sigilId ?? null, projectId ?? null]
  )
}

function renameConversation(id, title) {
  run("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?", [title, id])
}

function deleteConversation(id) {
  run('DELETE FROM conversations WHERE id = ?', [id])
}

function touchConversation(id) {
  run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [id])
}

function pinConversation(id) {
  run('UPDATE conversations SET pinned = 1 WHERE id = ?', [id])
}

function unpinConversation(id) {
  run('UPDATE conversations SET pinned = 0 WHERE id = ?', [id])
}

// ── Messages ──────────────────────────────────────────────────────────────────

function getMessages(convId) {
  return all('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [convId])
}

function addMessage(convId, role, content) {
  const id = insert('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)', [convId, role, content])
  run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [convId])
  return id
}

function updateMessage(id, content) {
  run('UPDATE messages SET content = ? WHERE id = ?', [content, id])
}

function deleteMessage(id) {
  run('DELETE FROM messages WHERE id = ?', [id])
}

// ── Sigils ────────────────────────────────────────────────────────────────────

function listSigils() {
  return all('SELECT * FROM sigils ORDER BY name ASC')
}

function getSigil(id) {
  return get('SELECT * FROM sigils WHERE id = ?', [id])
}

function createSigil(name, content) {
  return insert('INSERT INTO sigils (name, content) VALUES (?, ?)', [name, content])
}

function updateSigil(id, name, content) {
  run('UPDATE sigils SET name = ?, content = ? WHERE id = ?', [name, content, id])
}

function deleteSigil(id) {
  run('DELETE FROM sigils WHERE id = ?', [id])
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

function logTelemetry({ conversationId, model, promptTokens, completionTokens, ttftMs, durationMs }) {
  insert(
    'INSERT INTO telemetry (conversation_id, model, prompt_tokens, completion_tokens, ttft_ms, duration_ms) VALUES (?, ?, ?, ?, ?, ?)',
    [conversationId ?? null, model, promptTokens, completionTokens, ttftMs, durationMs]
  )
}

function getTelemetrySummary() {
  const allTime = get(`
    SELECT COUNT(*) as messages,
           COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total_tokens,
           COALESCE(SUM(completion_tokens), 0) as completion_tokens,
           COALESCE(AVG(NULLIF(ttft_ms, 0)), 0) as avg_ttft,
           COALESCE(AVG(NULLIF(duration_ms, 0)), 0) as avg_duration
    FROM telemetry
  `)
  const thisWeek = get(`
    SELECT COUNT(*) as messages,
           COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total_tokens
    FROM telemetry WHERE created_at >= datetime('now', '-7 days')
  `)
  const today = get(`
    SELECT COUNT(*) as messages,
           COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total_tokens
    FROM telemetry WHERE created_at >= datetime('now', 'start of day')
  `)
  const dailyLast30 = all(`
    SELECT date(created_at) as day,
           COUNT(*) as messages,
           COALESCE(SUM(prompt_tokens + completion_tokens), 0) as tokens
    FROM telemetry
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `)
  const topModels = all(`
    SELECT model,
           COUNT(*) as count,
           COALESCE(SUM(prompt_tokens + completion_tokens), 0) as tokens
    FROM telemetry
    GROUP BY model
    ORDER BY count DESC
    LIMIT 6
  `)
  return { allTime, thisWeek, today, dailyLast30, topModels }
}

// ── Settings ──────────────────────────────────────────────────────────────────

function getSetting(key, fallback = '') {
  const row = get('SELECT value FROM settings WHERE key = ?', [key])
  return row ? row.value : fallback
}

function setSetting(key, value) {
  run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value])
}

// ── Memory ────────────────────────────────────────────────────────────────────

function loadMemory() {
  try { return fs.readFileSync(MEMORY_PATH, 'utf8').trim() } catch { return '' }
}

function saveMemory(content) {
  fs.writeFileSync(MEMORY_PATH, content, 'utf8')
}

module.exports = {
  init,
  logTelemetry, getTelemetrySummary,
  listProjects, createProject, renameProject, deleteProject,
  listProjectFiles, addProjectFile, removeProjectFile,
  listConversations, listProjectConversations, getConversation, createConversation,
  renameConversation, deleteConversation, touchConversation,
  pinConversation, unpinConversation,
  getMessages, addMessage, updateMessage, deleteMessage,
  listSigils, getSigil, createSigil, updateSigil, deleteSigil,
  getSetting, setSetting,
  loadMemory, saveMemory,
}
