import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { setDb, initDb } from './db.js';
import {
  getAllEntities, getEntity, upsertEntity, updateEntityPerspective,
  getAllTensions, upsertTension,
  getOpenQuestions, addOpenQuestion, removeOpenQuestion,
  getTerminology, upsertTerm,
  getAllTools, getTool, upsertTool,
  getAllPocFeatures, upsertPocFeature,
  getDomain, getLastUpdated, getFullOntology,
  type EntityRow, type TensionRow, type ToolRow, type PocFeatureRow, type RolePerspective,
} from './ontology-store.js';

beforeEach(async () => {
  // Fresh in-memory DB for each test
  const client = createClient({ url: ':memory:' });
  setDb(client);
  await initDb();
});

describe('Entity CRUD', () => {
  it('creates and retrieves an entity', async () => {
    await upsertEntity({ id: 'contract', name: 'Contract', type: 'object' });
    const entity = await getEntity('contract');
    expect(entity).toBeDefined();
    expect(entity!.name).toBe('Contract');
    expect(entity!.type).toBe('object');
  });

  it('upserts (updates) an existing entity', async () => {
    await upsertEntity({ id: 'contract', name: 'Contract', type: 'object' });
    await upsertEntity({ id: 'contract', name: 'Contract v2', type: 'concept' });
    const entity = await getEntity('contract');
    expect(entity!.name).toBe('Contract v2');
    expect(entity!.type).toBe('concept');
  });

  it('returns all entities', async () => {
    await upsertEntity({ id: 'a', name: 'A', type: 'actor' });
    await upsertEntity({ id: 'b', name: 'B', type: 'concept' });
    const all = await getAllEntities();
    expect(all).toHaveLength(2);
  });

  it('returns null for missing entity', async () => {
    const entity = await getEntity('nonexistent');
    expect(entity).toBeNull();
  });

  it('stores and retrieves attributes', async () => {
    await upsertEntity({
      id: 'basis',
      name: 'Basis',
      type: 'concept',
      attributes: { unit: 'cents/bushel', sign: 'positive or negative' },
    });
    const entity = await getEntity('basis');
    expect(entity!.attributes).toEqual({ unit: 'cents/bushel', sign: 'positive or negative' });
  });

  it('stores and retrieves relationships', async () => {
    await upsertEntity({
      id: 'contract',
      name: 'Contract',
      type: 'object',
      relationships: [{ targetId: 'basis', relation: 'has', strength: 0.9 }],
    });
    const entity = await getEntity('contract');
    expect(entity!.relationships).toHaveLength(1);
    expect(entity!.relationships![0].targetId).toBe('basis');
  });
});

describe('Entity Perspectives', () => {
  it('adds a role perspective', async () => {
    await upsertEntity({ id: 'contract', name: 'Contract', type: 'object' });
    const perspective: RolePerspective = {
      primaryConcern: 'Risk management',
      terminology: ['basis contract', 'flat price'],
      painPoints: ['Complex pricing'],
    };
    const updated = await updateEntityPerspective('contract', 'merchant', perspective);
    expect(updated.perspectives).toBeDefined();
    expect(updated.perspectives!['merchant'].primaryConcern).toBe('Risk management');
  });

  it('adds multiple role perspectives', async () => {
    await upsertEntity({ id: 'contract', name: 'Contract', type: 'object' });
    await updateEntityPerspective('contract', 'merchant', { primaryConcern: 'Risk' });
    await updateEntityPerspective('contract', 'csr', { primaryConcern: 'Customer satisfaction' });
    const entity = await getEntity('contract');
    expect(Object.keys(entity!.perspectives!)).toHaveLength(2);
  });

  it('throws when entity does not exist', async () => {
    await expect(
      updateEntityPerspective('nonexistent', 'merchant', { primaryConcern: 'Test' })
    ).rejects.toThrow('Entity nonexistent not found');
  });
});

describe('Tension CRUD', () => {
  it('creates and retrieves a tension', async () => {
    await upsertTension({
      id: 'risk-vs-speed',
      description: 'Risk assessment vs. decision speed',
      tensionType: 'intra-role',
      roles: ['merchant'],
      entities: ['risk', 'pricing'],
      status: 'open',
    });
    const all = await getAllTensions();
    expect(all).toHaveLength(1);
    expect(all[0].tensionType).toBe('intra-role');
    expect(all[0].roles).toEqual(['merchant']);
  });

  it('upserts a tension', async () => {
    await upsertTension({
      id: 'risk-vs-speed',
      description: 'v1',
      tensionType: 'intra-role',
      roles: ['merchant'],
      entities: ['risk'],
      status: 'open',
    });
    await upsertTension({
      id: 'risk-vs-speed',
      description: 'v2',
      tensionType: 'inter-role',
      roles: ['merchant', 'csr'],
      entities: ['risk', 'pricing'],
      status: 'monitoring',
    });
    const all = await getAllTensions();
    expect(all).toHaveLength(1);
    expect(all[0].description).toBe('v2');
    expect(all[0].status).toBe('monitoring');
  });
});

describe('Open Questions', () => {
  it('adds and retrieves questions', async () => {
    await addOpenQuestion('How do merchants set basis?');
    await addOpenQuestion('What tools do CSRs use?');
    const questions = await getOpenQuestions();
    expect(questions).toHaveLength(2);
    expect(questions).toContain('How do merchants set basis?');
  });

  it('removes a question', async () => {
    await addOpenQuestion('Question to remove');
    await addOpenQuestion('Question to keep');
    await removeOpenQuestion('Question to remove');
    const questions = await getOpenQuestions();
    expect(questions).toHaveLength(1);
    expect(questions[0]).toBe('Question to keep');
  });

  it('ignores duplicate questions', async () => {
    await addOpenQuestion('Same question');
    await addOpenQuestion('Same question');
    const questions = await getOpenQuestions();
    expect(questions).toHaveLength(1);
  });
});

describe('Terminology', () => {
  it('adds and retrieves terms', async () => {
    await upsertTerm('basis', 'Difference between cash and futures price');
    await upsertTerm('flat price', 'All-in price including basis');
    const terms = await getTerminology();
    expect(Object.keys(terms)).toHaveLength(2);
    expect(terms['basis']).toBe('Difference between cash and futures price');
  });

  it('updates an existing term', async () => {
    await upsertTerm('basis', 'Old definition');
    await upsertTerm('basis', 'Updated definition');
    const terms = await getTerminology();
    expect(terms['basis']).toBe('Updated definition');
  });
});

describe('Tool CRUD', () => {
  it('creates and retrieves a tool', async () => {
    const tool: ToolRow = {
      id: 'excel',
      name: 'Microsoft Excel',
      category: 'analytics',
      isInternal: false,
      isPoc: false,
    };
    await upsertTool(tool);
    const retrieved = await getTool('excel');
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('Microsoft Excel');
    expect(retrieved!.isPoc).toBe(false);
  });

  it('stores tool usage by persona', async () => {
    await upsertTool({
      id: 'pricing-tool',
      name: 'Pricing Tool',
      category: 'pricing',
      isInternal: true,
      isPoc: true,
      usageByPersona: {
        merchant: { frequency: 'daily', proficiency: 'expert', sentiment: 'like' },
      },
    });
    const tool = await getTool('pricing-tool');
    expect(tool!.usageByPersona!['merchant'].frequency).toBe('daily');
    expect(tool!.usageByPersona!['merchant'].proficiency).toBe('expert');
  });

  it('returns all tools', async () => {
    await upsertTool({ id: 't1', name: 'T1', category: 'pricing', isInternal: false, isPoc: false });
    await upsertTool({ id: 't2', name: 'T2', category: 'analytics', isInternal: true, isPoc: true });
    const all = await getAllTools();
    expect(all).toHaveLength(2);
  });
});

describe('PoC Features', () => {
  it('creates and retrieves a PoC feature', async () => {
    await upsertPocFeature({
      id: 'auto-basis',
      name: 'Auto Basis Calculator',
      description: 'Automatically suggests basis adjustments',
      status: 'concept',
    });
    const all = await getAllPocFeatures();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Auto Basis Calculator');
  });

  it('stores benefits by persona', async () => {
    await upsertPocFeature({
      id: 'auto-basis',
      name: 'Auto Basis Calculator',
      description: 'Auto-suggest basis',
      status: 'designed',
      benefitsByPersona: {
        merchant: {
          benefitLevel: 'high',
          solvedPainPoints: ['manual calculation', 'inconsistent pricing'],
        },
      },
    });
    const all = await getAllPocFeatures();
    expect(all[0].benefitsByPersona!['merchant'].benefitLevel).toBe('high');
    expect(all[0].benefitsByPersona!['merchant'].solvedPainPoints).toHaveLength(2);
  });
});

describe('Full Ontology', () => {
  it('returns complete ontology state', async () => {
    await upsertEntity({ id: 'e1', name: 'Entity 1', type: 'concept' });
    await upsertTension({
      id: 't1', description: 'T1', tensionType: 'system',
      roles: ['merchant'], entities: ['e1'], status: 'open',
    });
    await addOpenQuestion('Q1');
    await upsertTerm('term1', 'Definition 1');

    const ontology = await getFullOntology();
    expect(ontology.domain).toBe('grain-origination');
    expect(ontology.entities).toHaveLength(1);
    expect(ontology.tensions).toHaveLength(1);
    expect(ontology.openQuestions).toHaveLength(1);
    expect(ontology.terminology['term1']).toBe('Definition 1');
    expect(ontology.lastUpdated).toBeDefined();
  });
});

describe('Metadata', () => {
  it('returns domain', async () => {
    const domain = await getDomain();
    expect(domain).toBe('grain-origination');
  });

  it('returns lastUpdated', async () => {
    const lastUpdated = await getLastUpdated();
    expect(lastUpdated).toBeDefined();
    // Should be a valid ISO timestamp
    expect(new Date(lastUpdated).getTime()).toBeGreaterThan(0);
  });
});
