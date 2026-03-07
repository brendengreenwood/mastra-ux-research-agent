import { getDb } from './db.js';

export interface TranscriptRow {
  id: string;
  source: string;
  persona: string;
  participantId?: string;
  context?: string;
  date?: string;
  duration?: number;
  classification: {
    dataType: string;
    methodology: string;
    phase: string;
    confidence: number;
  };
  rawContent: string;
  segments?: Array<{
    speaker: string;
    content: string;
    timestamp?: string;
    topics?: string[];
  }>;
  extractedTopics: string[];
  keyQuotes?: Array<{
    text: string;
    speaker: string;
    relevance: string;
  }>;
}

export async function getTranscript(id: string): Promise<TranscriptRow | null> {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM transcripts WHERE id = ?', args: [id] });
  return rs.rows.length > 0 ? rowToTranscript(rs.rows[0]) : null;
}

export async function upsertTranscript(t: TranscriptRow): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO transcripts (id, source, persona, participant_id, context, date, duration, classification, raw_content, segments, extracted_topics, key_quotes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            source = excluded.source,
            persona = excluded.persona,
            participant_id = excluded.participant_id,
            context = excluded.context,
            date = excluded.date,
            duration = excluded.duration,
            classification = excluded.classification,
            raw_content = excluded.raw_content,
            segments = excluded.segments,
            extracted_topics = excluded.extracted_topics,
            key_quotes = excluded.key_quotes,
            updated_at = datetime('now')`,
    args: [
      t.id,
      t.source,
      t.persona,
      t.participantId || null,
      t.context || null,
      t.date || null,
      t.duration || null,
      JSON.stringify(t.classification),
      t.rawContent,
      t.segments ? JSON.stringify(t.segments) : null,
      JSON.stringify(t.extractedTopics),
      t.keyQuotes ? JSON.stringify(t.keyQuotes) : null,
    ],
  });
}

export async function listTranscripts(filterByPersona?: string): Promise<TranscriptRow[]> {
  const db = getDb();
  const rs = filterByPersona
    ? await db.execute({ sql: 'SELECT * FROM transcripts WHERE persona = ?', args: [filterByPersona] })
    : await db.execute('SELECT * FROM transcripts');
  return rs.rows.map(rowToTranscript);
}

function rowToTranscript(row: Record<string, unknown>): TranscriptRow {
  return {
    id: row.id as string,
    source: row.source as string,
    persona: row.persona as string,
    participantId: (row.participant_id as string) || undefined,
    context: (row.context as string) || undefined,
    date: (row.date as string) || undefined,
    duration: (row.duration as number) || undefined,
    classification: JSON.parse(row.classification as string),
    rawContent: row.raw_content as string,
    segments: row.segments ? JSON.parse(row.segments as string) : undefined,
    extractedTopics: JSON.parse(row.extracted_topics as string),
    keyQuotes: row.key_quotes ? JSON.parse(row.key_quotes as string) : undefined,
  };
}
