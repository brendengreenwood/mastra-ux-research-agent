import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { setDb, initDb } from './db.js';
import { addEvidence, getEvidenceForTarget, getEvidenceByTranscript } from './evidence-store.js';

beforeEach(async () => {
  const client = createClient({ url: ':memory:' });
  setDb(client);
  await initDb();
});

describe('Evidence CRUD', () => {
  it('adds and retrieves evidence for an entity', async () => {
    const id = await addEvidence({
      targetType: 'entity',
      targetId: 'contract',
      transcriptId: 'transcript-merchant-001',
      quote: 'I review contracts every morning',
      context: 'Morning routine discussion',
    });
    expect(id).toBeGreaterThan(0);

    const evidence = await getEvidenceForTarget('entity', 'contract');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].transcriptId).toBe('transcript-merchant-001');
    expect(evidence[0].quote).toBe('I review contracts every morning');
  });

  it('tracks multiple evidence sources for same entity', async () => {
    await addEvidence({
      targetType: 'entity',
      targetId: 'basis',
      transcriptId: 'transcript-merchant-001',
      quote: 'Basis is the most important factor',
    });
    await addEvidence({
      targetType: 'entity',
      targetId: 'basis',
      transcriptId: 'transcript-csr-002',
      quote: 'Customers always ask about basis',
    });
    const evidence = await getEvidenceForTarget('entity', 'basis');
    expect(evidence).toHaveLength(2);
  });

  it('retrieves all evidence from a transcript', async () => {
    await addEvidence({
      targetType: 'entity',
      targetId: 'contract',
      transcriptId: 'transcript-merchant-001',
    });
    await addEvidence({
      targetType: 'tension',
      targetId: 'risk-vs-speed',
      transcriptId: 'transcript-merchant-001',
    });
    await addEvidence({
      targetType: 'entity',
      targetId: 'other',
      transcriptId: 'transcript-csr-002',
    });

    const evidence = await getEvidenceByTranscript('transcript-merchant-001');
    expect(evidence).toHaveLength(2);
  });

  it('stores lens type metadata', async () => {
    await addEvidence({
      targetType: 'entity',
      targetId: 'pricing',
      transcriptId: 'transcript-001',
      lensType: 'OOUX',
    });
    const evidence = await getEvidenceForTarget('entity', 'pricing');
    expect(evidence[0].lensType).toBe('OOUX');
  });

  it('returns empty array for no evidence', async () => {
    const evidence = await getEvidenceForTarget('entity', 'nonexistent');
    expect(evidence).toEqual([]);
  });
});
