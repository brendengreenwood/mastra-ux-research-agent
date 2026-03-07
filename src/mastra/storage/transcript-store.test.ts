import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { setDb, initDb } from './db.js';
import { getTranscript, upsertTranscript, listTranscripts, type TranscriptRow } from './transcript-store.js';

beforeEach(async () => {
  const client = createClient({ url: ':memory:' });
  setDb(client);
  await initDb();
});

const sampleTranscript: TranscriptRow = {
  id: 'transcript-merchant-001',
  source: 'interview-2024-01',
  persona: 'merchant',
  rawContent: 'I usually check basis levels first thing in the morning before making any offers.',
  classification: {
    dataType: 'behavioral',
    methodology: 'qualitative',
    phase: 'discovery',
    confidence: 0.85,
  },
  extractedTopics: [],
};

describe('Transcript CRUD', () => {
  it('creates and retrieves a transcript', async () => {
    await upsertTranscript(sampleTranscript);
    const retrieved = await getTranscript('transcript-merchant-001');
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('transcript-merchant-001');
    expect(retrieved!.persona).toBe('merchant');
    expect(retrieved!.rawContent).toContain('basis levels');
  });

  it('stores classification as structured data', async () => {
    await upsertTranscript(sampleTranscript);
    const retrieved = await getTranscript('transcript-merchant-001');
    expect(retrieved!.classification.dataType).toBe('behavioral');
    expect(retrieved!.classification.methodology).toBe('qualitative');
    expect(retrieved!.classification.phase).toBe('discovery');
    expect(retrieved!.classification.confidence).toBe(0.85);
  });

  it('stores optional fields', async () => {
    await upsertTranscript({
      ...sampleTranscript,
      participantId: 'P001',
      context: 'Morning interview, pre-market',
      date: '2024-01-15',
      duration: 45,
      extractedTopics: ['basis', 'pricing', 'timing'],
      keyQuotes: [{ text: 'I check basis first thing every morning', speaker: 'merchant', relevance: 'daily workflow' }],
    });
    const retrieved = await getTranscript('transcript-merchant-001');
    expect(retrieved!.participantId).toBe('P001');
    expect(retrieved!.context).toBe('Morning interview, pre-market');
    expect(retrieved!.extractedTopics).toEqual(['basis', 'pricing', 'timing']);
    expect(retrieved!.keyQuotes).toEqual([{ text: 'I check basis first thing every morning', speaker: 'merchant', relevance: 'daily workflow' }]);
  });

  it('returns null for missing transcript', async () => {
    const retrieved = await getTranscript('nonexistent');
    expect(retrieved).toBeNull();
  });

  it('upserts (updates) existing transcript', async () => {
    await upsertTranscript(sampleTranscript);
    await upsertTranscript({
      ...sampleTranscript,
      extractedTopics: ['basis', 'pricing'],
      keyQuotes: [{ text: 'New quote', speaker: 'merchant', relevance: 'pricing' }],
    });
    const retrieved = await getTranscript('transcript-merchant-001');
    expect(retrieved!.extractedTopics).toEqual(['basis', 'pricing']);
    expect(retrieved!.keyQuotes).toEqual([{ text: 'New quote', speaker: 'merchant', relevance: 'pricing' }]);
  });
});

describe('Transcript Listing', () => {
  it('lists all transcripts', async () => {
    await upsertTranscript(sampleTranscript);
    await upsertTranscript({
      ...sampleTranscript,
      id: 'transcript-csr-001',
      persona: 'csr',
    });
    const all = await listTranscripts();
    expect(all).toHaveLength(2);
  });

  it('filters by persona', async () => {
    await upsertTranscript(sampleTranscript);
    await upsertTranscript({
      ...sampleTranscript,
      id: 'transcript-csr-001',
      persona: 'csr',
    });
    const merchants = await listTranscripts('merchant');
    expect(merchants).toHaveLength(1);
    expect(merchants[0].persona).toBe('merchant');
  });

  it('returns empty array when no transcripts', async () => {
    const all = await listTranscripts();
    expect(all).toEqual([]);
  });
});
