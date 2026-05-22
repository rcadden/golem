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
      role TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
      content TEXT NOT NULL,
      tool_calls TEXT,
      tool_call_id TEXT,
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
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      system_prompt TEXT NOT NULL,
      starter_message TEXT NOT NULL DEFAULT '',
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
  try { db.run('ALTER TABLE projects ADD COLUMN directory_path TEXT') } catch {}
  try { db.run('ALTER TABLE conversations ADD COLUMN skill_id INTEGER') } catch {}
  try { db.run('ALTER TABLE projects ADD COLUMN num_ctx INTEGER') } catch {}

  // Tool-call migration: expand role CHECK and add tool_calls/tool_call_id columns.
  // SQLite doesn't support altering CHECK in place, so rebuild the table if needed.
  const cols = all('PRAGMA table_info(messages)').map(c => c.name)
  if (!cols.includes('tool_calls')) {
    db.run(`
      CREATE TABLE messages_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_call_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      INSERT INTO messages_new (id, conversation_id, role, content, created_at)
        SELECT id, conversation_id, role, content, created_at FROM messages;
      DROP TABLE messages;
      ALTER TABLE messages_new RENAME TO messages;
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    `)
  }

  seedBuiltinSkills()
  persist()
}

function seedBuiltinSkills() {
  const BUILTINS = [
    {
      name: 'Sigil Architect',
      category: 'Golem',
      system_prompt: `You are a Sigil Architect — an expert at crafting focused, effective system prompts for AI assistants.

A sigil in Golem is a named system prompt that shapes how the AI behaves for a specific role or use case. Great sigils are specific, not generic — they define a persona, a purpose, and clear guardrails.

Your process:
1. Ask the user what role or context they want the sigil for (one question at a time)
2. Clarify tone, expertise level, any constraints or must-haves
3. Draft a concise system prompt — typically 3–8 sentences
4. Refine based on feedback until the user is satisfied

When the sigil is ready, present the final version inside a fenced code block so it's easy to copy directly into the Sigil creation form. Do not add commentary inside the block — only the sigil content itself.`,
      starter_message: "Let's build a sigil. What role or use case do you have in mind?",
    },
    {
      name: 'Skill Architect',
      category: 'Golem',
      system_prompt: `You are a Skill Architect — an expert at designing AI workflow templates called "skills" for Golem.

A skill has four parts:
- **Name** — Short, action-oriented (e.g. "Code Reviewer", "Meeting Summarizer")
- **Category** — Groups skills in the sidebar (e.g. "Development", "Writing", "Research")
- **System prompt** — The AI's standing instructions for this skill context
- **Starter message** — Optional pre-filled message that appears in the input when the skill is launched, prompting the user to provide their content

Your process:
1. Ask what the user wants to accomplish with the skill (one question at a time)
2. Clarify the domain, tone, and any specific behaviors or constraints
3. Draft all four components
4. Refine until satisfied

When the skill is ready, present it in this exact format so the user can copy each field directly into the Skill creation form:

**Name:** ...
**Category:** ...

**System prompt:**
\`\`\`
...
\`\`\`

**Starter message:**
\`\`\`
...
\`\`\``,
      starter_message: "Let's build a skill. What do you want it to help you do?",
    },
  ]

  for (const skill of BUILTINS) {
    const existing = get('SELECT id FROM skills WHERE name = ? AND category = ?', [skill.name, skill.category])
    if (!existing) {
      insert(
        'INSERT INTO skills (name, category, system_prompt, starter_message) VALUES (?, ?, ?, ?)',
        [skill.name, skill.category, skill.system_prompt, skill.starter_message]
      )
    }
  }
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

function setProjectDirectory(id, dirPath) {
  run('UPDATE projects SET directory_path = ? WHERE id = ?', [dirPath, id])
}

function getProject(id) {
  return get('SELECT * FROM projects WHERE id = ?', [id])
}

function setProjectNumCtx(id, numCtx) {
  run('UPDATE projects SET num_ctx = ? WHERE id = ?', [numCtx ?? null, id])
}

function clearProjectFiles(projectId) {
  run('DELETE FROM project_files WHERE project_id = ?', [projectId])
}

// ── Conversations ─────────────────────────────────────────────────────────────

const CONV_SELECT = `
  SELECT c.*, s.name as sigil_name, sk.name as skill_name
  FROM conversations c
  LEFT JOIN sigils s ON c.sigil_id = s.id
  LEFT JOIN skills sk ON c.skill_id = sk.id
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

function createConversation(title, model, sigilId = null, projectId = null, skillId = null) {
  return insert(
    'INSERT INTO conversations (title, model, sigil_id, project_id, skill_id) VALUES (?, ?, ?, ?, ?)',
    [title, model, sigilId ?? null, projectId ?? null, skillId ?? null]
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

function addMessage(convId, role, content, opts = {}) {
  const toolCalls = opts.toolCalls ? JSON.stringify(opts.toolCalls) : null
  const toolCallId = opts.toolCallId ?? null
  const id = insert(
    'INSERT INTO messages (conversation_id, role, content, tool_calls, tool_call_id) VALUES (?, ?, ?, ?, ?)',
    [convId, role, content, toolCalls, toolCallId]
  )
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

// ── Skills ────────────────────────────────────────────────────────────────────

function listSkills() {
  return all('SELECT * FROM skills ORDER BY category ASC, name ASC')
}

function getSkill(id) {
  return get('SELECT * FROM skills WHERE id = ?', [id])
}

function createSkill(name, category, systemPrompt, starterMessage) {
  return insert(
    'INSERT INTO skills (name, category, system_prompt, starter_message) VALUES (?, ?, ?, ?)',
    [name, category, systemPrompt, starterMessage ?? '']
  )
}

function updateSkill(id, name, category, systemPrompt, starterMessage) {
  run(
    'UPDATE skills SET name = ?, category = ?, system_prompt = ?, starter_message = ? WHERE id = ?',
    [name, category, systemPrompt, starterMessage ?? '', id]
  )
}

function deleteSkill(id) {
  run('DELETE FROM skills WHERE id = ?', [id])
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
  getProject, setProjectDirectory, setProjectNumCtx, clearProjectFiles,
  listProjectFiles, addProjectFile, removeProjectFile,
  listConversations, listProjectConversations, getConversation, createConversation,
  renameConversation, deleteConversation, touchConversation,
  pinConversation, unpinConversation,
  getMessages, addMessage, updateMessage, deleteMessage,
  listSigils, getSigil, createSigil, updateSigil, deleteSigil,
  listSkills, getSkill, createSkill, updateSkill, deleteSkill,
  getSetting, setSetting,
  loadMemory, saveMemory,
}
