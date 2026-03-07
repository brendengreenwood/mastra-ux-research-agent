import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    client = createClient({ url: 'file:./ux-research.db' });
  }
  return client;
}

/** Override the database client (for testing with in-memory DB) */
export function setDb(newClient: Client): void {
  client = newClient;
}

export async function initDb(): Promise<void> {
  const db = getDb();

  await db.batch([
    `CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      attributes TEXT,
      perspectives TEXT,
      relationships TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS tensions (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      tension_type TEXT NOT NULL,
      roles TEXT NOT NULL,
      entities TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      evidence TEXT,
      implications TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS open_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS terminology (
      term TEXT PRIMARY KEY,
      definition TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      vendor TEXT,
      is_internal INTEGER DEFAULT 0,
      is_poc INTEGER DEFAULT 0,
      description TEXT,
      usage_by_persona TEXT,
      integrates_with TEXT,
      replaced_by TEXT,
      tool_tensions TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS poc_features (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      benefits_by_persona TEXT,
      status TEXT DEFAULT 'concept',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      persona TEXT NOT NULL,
      participant_id TEXT,
      context TEXT,
      date TEXT,
      duration INTEGER,
      classification TEXT NOT NULL,
      raw_content TEXT NOT NULL,
      segments TEXT,
      extracted_topics TEXT,
      key_quotes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS ontology_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript_id TEXT NOT NULL,
      text TEXT NOT NULL,
      speaker TEXT NOT NULL,
      persona TEXT NOT NULL,
      topic TEXT,
      sentiment TEXT,
      lens_type TEXT,
      relevance TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS ontology_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS evidence_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      transcript_id TEXT NOT NULL,
      quote TEXT,
      context TEXT,
      lens_type TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ], 'write');

  // Ensure domain meta exists
  const meta = await db.execute({ sql: 'SELECT value FROM ontology_meta WHERE key = ?', args: ['domain'] });
  if (meta.rows.length === 0) {
    await db.execute({ sql: 'INSERT INTO ontology_meta (key, value) VALUES (?, ?)', args: ['domain', 'grain-origination'] });
    await db.execute({ sql: 'INSERT INTO ontology_meta (key, value) VALUES (?, ?)', args: ['last_updated', new Date().toISOString()] });
  }
}
