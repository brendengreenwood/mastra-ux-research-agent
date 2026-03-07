import { getDb } from './db.js';

export interface Quote {
  id?: number;
  transcriptId: string;
  text: string;
  speaker: string;
  persona: string;
  topic?: string;
  sentiment?: string;
  lensType?: string;
  relevance?: string;
  createdAt?: string;
}

export async function addQuote(quote: Quote): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO quotes (transcript_id, text, speaker, persona, topic, sentiment, lens_type, relevance)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      quote.transcriptId,
      quote.text,
      quote.speaker,
      quote.persona,
      quote.topic ?? null,
      quote.sentiment ?? null,
      quote.lensType ?? null,
      quote.relevance ?? null,
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function addQuotes(quotes: Quote[]): Promise<number> {
  let count = 0;
  for (const quote of quotes) {
    await addQuote(quote);
    count++;
  }
  return count;
}

export async function getQuotesByTranscript(transcriptId: string): Promise<Quote[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM quotes WHERE transcript_id = ? ORDER BY id',
    args: [transcriptId],
  });
  return result.rows.map(rowToQuote);
}

export async function getQuotesByPersona(persona: string): Promise<Quote[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM quotes WHERE persona = ? ORDER BY id DESC',
    args: [persona],
  });
  return result.rows.map(rowToQuote);
}

export async function getQuotesByTopic(topic: string): Promise<Quote[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM quotes WHERE topic = ? ORDER BY id DESC',
    args: [topic],
  });
  return result.rows.map(rowToQuote);
}

export async function getQuotesByLens(lensType: string): Promise<Quote[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM quotes WHERE lens_type = ? ORDER BY id DESC',
    args: [lensType],
  });
  return result.rows.map(rowToQuote);
}

export async function searchQuotes(query: string): Promise<Quote[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM quotes WHERE text LIKE ? ORDER BY id DESC',
    args: [`%${query}%`],
  });
  return result.rows.map(rowToQuote);
}

function rowToQuote(row: Record<string, unknown>): Quote {
  return {
    id: Number(row.id),
    transcriptId: row.transcript_id as string,
    text: row.text as string,
    speaker: row.speaker as string,
    persona: row.persona as string,
    topic: row.topic as string | undefined,
    sentiment: row.sentiment as string | undefined,
    lensType: row.lens_type as string | undefined,
    relevance: row.relevance as string | undefined,
    createdAt: row.created_at as string | undefined,
  };
}
