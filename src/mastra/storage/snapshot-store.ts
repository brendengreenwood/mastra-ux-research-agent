import { getDb } from './db.js';
import { getFullOntology } from './ontology-store.js';

export interface OntologySnapshot {
  id?: number;
  snapshot: string;
  reason?: string;
  createdAt?: string;
}

export async function takeSnapshot(reason?: string): Promise<number> {
  const db = getDb();
  const ontology = await getFullOntology();
  const result = await db.execute({
    sql: 'INSERT INTO ontology_snapshots (snapshot, reason) VALUES (?, ?)',
    args: [JSON.stringify(ontology), reason ?? null],
  });
  return Number(result.lastInsertRowid);
}

export async function getSnapshot(id: number): Promise<OntologySnapshot | null> {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM ontology_snapshots WHERE id = ?', args: [id] });
  if (rs.rows.length === 0) return null;
  return rowToSnapshot(rs.rows[0]);
}

export async function listSnapshots(): Promise<Array<{ id: number; reason?: string; createdAt?: string }>> {
  const db = getDb();
  const rs = await db.execute('SELECT id, reason, created_at FROM ontology_snapshots ORDER BY id DESC');
  return rs.rows.map(row => ({
    id: Number(row.id),
    reason: (row.reason as string) || undefined,
    createdAt: (row.created_at as string) || undefined,
  }));
}

export async function getLatestSnapshot(): Promise<OntologySnapshot | null> {
  const db = getDb();
  const rs = await db.execute('SELECT * FROM ontology_snapshots ORDER BY id DESC LIMIT 1');
  if (rs.rows.length === 0) return null;
  return rowToSnapshot(rs.rows[0]);
}

function rowToSnapshot(row: Record<string, unknown>): OntologySnapshot {
  return {
    id: Number(row.id),
    snapshot: row.snapshot as string,
    reason: (row.reason as string) || undefined,
    createdAt: (row.created_at as string) || undefined,
  };
}
