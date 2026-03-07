import { getDb } from './db.js';

export interface EvidenceSource {
  id?: number;
  targetType: 'entity' | 'tension' | 'insight' | 'term';
  targetId: string;
  transcriptId: string;
  quote?: string;
  context?: string;
  lensType?: string;
  createdAt?: string;
}

export async function addEvidence(ev: EvidenceSource): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO evidence_sources (target_type, target_id, transcript_id, quote, context, lens_type)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      ev.targetType,
      ev.targetId,
      ev.transcriptId,
      ev.quote ?? null,
      ev.context ?? null,
      ev.lensType ?? null,
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function getEvidenceForTarget(targetType: string, targetId: string): Promise<EvidenceSource[]> {
  const db = getDb();
  const rs = await db.execute({
    sql: 'SELECT * FROM evidence_sources WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC',
    args: [targetType, targetId],
  });
  return rs.rows.map(rowToEvidence);
}

export async function getEvidenceByTranscript(transcriptId: string): Promise<EvidenceSource[]> {
  const db = getDb();
  const rs = await db.execute({
    sql: 'SELECT * FROM evidence_sources WHERE transcript_id = ? ORDER BY created_at DESC',
    args: [transcriptId],
  });
  return rs.rows.map(rowToEvidence);
}

function rowToEvidence(row: Record<string, unknown>): EvidenceSource {
  return {
    id: Number(row.id),
    targetType: row.target_type as EvidenceSource['targetType'],
    targetId: row.target_id as string,
    transcriptId: row.transcript_id as string,
    quote: (row.quote as string) || undefined,
    context: (row.context as string) || undefined,
    lensType: (row.lens_type as string) || undefined,
    createdAt: (row.created_at as string) || undefined,
  };
}
