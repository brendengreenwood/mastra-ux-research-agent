import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { setDb, initDb } from '../../mastra/storage/db.js';
import {
  upsertEntity, updateEntityPerspective, upsertTension,
  upsertTool, upsertPocFeature, upsertTerm,
  addQuote, addEvidence, takeSnapshot,
  upsertTranscript,
} from '../../mastra/storage/index.js';
import { createApp } from '../app.js';

const app = createApp();

function req(path: string) {
  return app.request(`http://localhost${path}`);
}

beforeEach(async () => {
  const client = createClient({ url: ':memory:' });
  setDb(client);
  await initDb();
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await req('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('Ontology routes', () => {
  beforeEach(async () => {
    await upsertEntity({ id: 'basis', name: 'Basis', type: 'concept' });
    await upsertEntity({ id: 'contract', name: 'Contract', type: 'object' });
    await upsertTension({
      id: 't1', description: 'Speed vs accuracy', tensionType: 'intra-role',
      roles: ['merchant'], entities: ['basis'], status: 'open',
    });
  });

  it('GET /api/ontology returns full ontology', async () => {
    const res = await req('/api/ontology');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entities).toHaveLength(2);
    expect(data.tensions).toHaveLength(1);
  });

  it('GET /api/entities returns all entities', async () => {
    const res = await req('/api/entities');
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it('GET /api/entities/:id returns single entity', async () => {
    const res = await req('/api/entities/basis');
    const data = await res.json();
    expect(data.name).toBe('Basis');
  });

  it('GET /api/entities/:id returns 404 for missing', async () => {
    const res = await req('/api/entities/nonexistent');
    expect(res.status).toBe(404);
  });

  it('GET /api/tensions returns all tensions', async () => {
    const res = await req('/api/tensions');
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].description).toBe('Speed vs accuracy');
  });

  it('GET /api/tools returns all tools', async () => {
    await upsertTool({
      id: 'excel', name: 'Excel', category: 'analytics', isPoc: false, isInternal: false,
    });
    const res = await req('/api/tools');
    const data = await res.json();
    expect(data).toHaveLength(1);
  });
});

describe('Persona routes', () => {
  beforeEach(async () => {
    await upsertEntity({ id: 'basis', name: 'Basis', type: 'concept' });
    await updateEntityPerspective('basis', 'merchant', {
      primaryConcern: 'Getting the best price',
      painPoints: ['Manual calculations'],
    });
  });

  it('GET /api/personas returns persona list with stats', async () => {
    const res = await req('/api/personas');
    const data = await res.json();
    expect(data).toHaveLength(4);
    const merchant = data.find((p: any) => p.id === 'merchant');
    expect(merchant.entityCount).toBe(1);
    expect(merchant.label).toBe('Merchant');
  });

  it('GET /api/personas/:id/profile returns full profile', async () => {
    const res = await req('/api/personas/merchant/profile');
    const data = await res.json();
    expect(data.label).toBe('Merchant');
    expect(data.profile.coreEntities).toHaveLength(1);
    expect(data.profile.coreEntities[0].primaryConcern).toBe('Getting the best price');
  });

  it('GET /api/personas/:id/profile returns 404 for unknown', async () => {
    const res = await req('/api/personas/unknown/profile');
    expect(res.status).toBe(404);
  });
});

describe('Transcript routes', () => {
  beforeEach(async () => {
    await upsertTranscript({
      id: 't1', source: 'interview', persona: 'merchant',
      rawContent: 'Hello world', extractedTopics: ['pricing'],
      classification: { dataType: 'attitudinal', methodology: 'qualitative', phase: 'discovery', confidence: 0.8 },
    });
    await upsertTranscript({
      id: 't2', source: 'interview', persona: 'csr',
      rawContent: 'Another transcript', extractedTopics: [],
      classification: { dataType: 'behavioral', methodology: 'qualitative', phase: 'discovery', confidence: 0.7 },
    });
  });

  it('GET /api/transcripts returns all', async () => {
    const res = await req('/api/transcripts');
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it('GET /api/transcripts?persona= filters', async () => {
    const res = await req('/api/transcripts?persona=merchant');
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].persona).toBe('merchant');
  });

  it('GET /api/transcripts/:id returns single', async () => {
    const res = await req('/api/transcripts/t1');
    const data = await res.json();
    expect(data.rawContent).toBe('Hello world');
  });

  it('GET /api/transcripts/:id returns 404 for missing', async () => {
    const res = await req('/api/transcripts/missing');
    expect(res.status).toBe(404);
  });
});

describe('Quote routes', () => {
  beforeEach(async () => {
    await addQuote({
      transcriptId: 't1', text: 'Basis matters most', speaker: 'John',
      persona: 'merchant', topic: 'pricing', sentiment: 'neutral',
    });
    await addQuote({
      transcriptId: 't2', text: 'Customers hate waiting', speaker: 'Jane',
      persona: 'csr', topic: 'service',
    });
  });

  it('GET /api/quotes?persona= filters by persona', async () => {
    const res = await req('/api/quotes?persona=merchant');
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].text).toBe('Basis matters most');
  });

  it('GET /api/quotes?topic= filters by topic', async () => {
    const res = await req('/api/quotes?topic=service');
    const data = await res.json();
    expect(data).toHaveLength(1);
  });

  it('GET /api/quotes/search?q= searches text', async () => {
    const res = await req('/api/quotes/search?q=hate');
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].speaker).toBe('Jane');
  });

  it('GET /api/quotes returns all when no filter', async () => {
    const res = await req('/api/quotes');
    const data = await res.json();
    expect(data).toHaveLength(2);
  });
});

describe('Evidence routes', () => {
  beforeEach(async () => {
    await addEvidence({
      targetType: 'entity', targetId: 'basis',
      transcriptId: 't1', quote: 'Basis is key',
    });
    await addEvidence({
      targetType: 'tension', targetId: 'risk-speed',
      transcriptId: 't1', context: 'Risk discussion',
    });
  });

  it('GET /api/evidence/:type/:id returns evidence chain', async () => {
    const res = await req('/api/evidence/entity/basis');
    const data = await res.json();
    expect(data.count).toBe(1);
    expect(data.sources[0].quote).toBe('Basis is key');
  });

  it('GET /api/evidence/transcript/:id returns all from transcript', async () => {
    const res = await req('/api/evidence/transcript/t1');
    const data = await res.json();
    expect(data.count).toBe(2);
  });
});

describe('Snapshot routes', () => {
  it('GET /api/snapshots returns empty list initially', async () => {
    const res = await req('/api/snapshots');
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it('GET /api/snapshots returns snapshots after taking one', async () => {
    await takeSnapshot('test snapshot');
    const res = await req('/api/snapshots');
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].reason).toBe('test snapshot');
  });

  it('GET /api/snapshots/:id returns snapshot with ontology', async () => {
    const id = await takeSnapshot('detail test');
    const res = await req(`/api/snapshots/${id}`);
    const data = await res.json();
    expect(data.reason).toBe('detail test');
    expect(data.ontology).toBeDefined();
  });

  it('GET /api/snapshots/:id returns 404 for missing', async () => {
    const res = await req('/api/snapshots/999');
    expect(res.status).toBe(404);
  });
});
