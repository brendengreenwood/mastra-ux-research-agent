import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { setDb, initDb } from '../storage/db.js';

import {
  generateExpectationsTool,
  assessCapacityTool,
  compareToExpectationsTool,
  synthesizeInsightsTool,
} from './cognition-tools.js';

const dummyContext = {} as any;

beforeEach(async () => {
  const client = createClient({ url: ':memory:' });
  setDb(client);
  await initDb();
});

describe('generateExpectationsTool', () => {
  it('generates expectations from transcript topics and ontology', async () => {
    const result = await generateExpectationsTool.execute!(
      {
        transcriptId: 'test-001',
        transcriptTopics: ['pricing', 'basis', 'contracts'],
        participantType: 'merchant',
        currentOntologyEntities: ['Contract', 'Basis', 'Futures'],
        currentOpenQuestions: ['How do merchants set basis?'],
      },
      dummyContext,
    );
    expect(result).toHaveProperty('expectedEntities');
    expect(result).toHaveProperty('expectedTopics');
    expect(result).toHaveProperty('hypotheses');
    expect(result).toHaveProperty('generatedAt');
    expect((result as any).expectedTopics).toEqual(['pricing', 'basis', 'contracts']);
  });
});

describe('assessCapacityTool', () => {
  it('reports low capacity for empty ontology', async () => {
    const result = await assessCapacityTool.execute!(
      {
        transcriptId: 'test-001',
        transcriptTopics: ['pricing', 'basis', 'hedging'],
        ontologyEntityCount: 0,
        ontologyEntities: [],
        ontologyTerms: [],
        ontologyRelationshipCount: 0,
      },
      dummyContext,
    );
    expect(result).toHaveProperty('overallCapacity');
    expect(result).toHaveProperty('gaps');
    expect(result).toHaveProperty('recommendations');
    expect((result as any).overallCapacity).toBe('low');
  });

  it('reports higher capacity with populated ontology', async () => {
    const result = await assessCapacityTool.execute!(
      {
        transcriptId: 'test-001',
        transcriptTopics: ['pricing', 'basis', 'contracts'],
        ontologyEntityCount: 5,
        ontologyEntities: ['Pricing', 'Basis', 'Contract', 'Merchant', 'Futures'],
        ontologyTerms: ['basis', 'pricing strategy', 'contract terms'],
        ontologyRelationshipCount: 8,
      },
      dummyContext,
    );
    expect((result as any).overallCapacity).toBe('high');
    expect((result as any).ontologyDepth.entityCoverage).toBeGreaterThan(0.5);
    expect((result as any).ontologyDepth.terminologyCoverage).toBeGreaterThan(0.5);
  });
});

describe('compareToExpectationsTool', () => {
  it('identifies surprises from unexpected entities', async () => {
    const result = await compareToExpectationsTool.execute!(
      {
        transcriptId: 'test-001',
        expectations: {
          transcriptId: 'test-001',
          expectedEntities: ['contract', 'basis'],
          expectedTopics: ['pricing', 'hedging'],
          expectedTensions: [],
          hypotheses: [
            { statement: 'Merchants check basis daily', confidence: 0.8, basis: 'Common practice' },
          ],
          openQuestions: [],
          generatedAt: new Date().toISOString(),
        },
        foundEntities: ['contract', 'basis', 'weather'],
        foundTopics: ['pricing', 'weather-impact'],
        foundTensions: [],
      },
      dummyContext,
    );

    expect(result).toHaveProperty('surprises');
    expect(result).toHaveProperty('confirmedHypotheses');
    expect(result).toHaveProperty('newQuestions');

    // 'weather' was unexpected
    const surprises = (result as any).surprises;
    expect(surprises.some((s: any) => s.description.includes('weather'))).toBe(true);
  });

  it('detects missing expected entities', async () => {
    const result = await compareToExpectationsTool.execute!(
      {
        transcriptId: 'test-001',
        expectations: {
          transcriptId: 'test-001',
          expectedEntities: ['contract', 'basis', 'futures'],
          expectedTopics: ['pricing'],
          expectedTensions: [],
          hypotheses: [],
          openQuestions: [],
          generatedAt: new Date().toISOString(),
        },
        foundEntities: ['contract'],
        foundTopics: ['pricing'],
        foundTensions: [],
      },
      dummyContext,
    );
    const surprises = (result as any).surprises;
    const missing = surprises.filter((s: any) => s.type === 'missing_expected');
    expect(missing.length).toBeGreaterThan(0);
  });
});

describe('synthesizeInsightsTool', () => {
  it('produces insights from comparison and lens results', async () => {
    const result = await synthesizeInsightsTool.execute!(
      {
        transcriptId: 'test-001',
        comparison: {
          transcriptId: 'test-001',
          expectations: {
            transcriptId: 'test-001',
            expectedEntities: ['contract'],
            expectedTopics: ['pricing'],
            expectedTensions: [],
            hypotheses: [],
            openQuestions: [],
            generatedAt: new Date().toISOString(),
          },
          findings: {
            foundEntities: ['contract', 'weather'],
            foundTopics: ['pricing', 'weather-impact'],
            foundTensions: [],
          },
          surprises: [
            {
              type: 'unexpected_entity' as const,
              description: 'Weather affects pricing decisions',
              significance: 'high' as const,
            },
          ],
          confirmedHypotheses: [],
          refutedHypotheses: [],
          newQuestions: ['How much does weather impact daily basis?'],
        },
        lensResults: [
          { lens: 'JTBD', keyFindings: ['Merchants want faster basis info'] },
          { lens: 'OOUX', keyFindings: ['Weather is a core object'] },
        ],
      },
      dummyContext,
    );

    const insights = (result as any).insights;
    const ontologyUpdates = (result as any).ontologyUpdates;
    const followUp = (result as any).followUpResearch;

    // Should have insights from surprises + lens results
    expect(insights.length).toBeGreaterThanOrEqual(3); // 1 surprise + 2 lens findings
    expect(insights.some((i: any) => i.insight.includes('[JTBD]'))).toBe(true);
    expect(insights.some((i: any) => i.insight.includes('[OOUX]'))).toBe(true);

    // Should have ontology updates from surprises + lens results
    expect(ontologyUpdates.length).toBeGreaterThanOrEqual(1);

    // Should pass through follow-up research
    expect(followUp).toContain('How much does weather impact daily basis?');
  });

  it('includes transcript ID in evidence', async () => {
    const result = await synthesizeInsightsTool.execute!(
      {
        transcriptId: 'transcript-42',
        comparison: {
          transcriptId: 'transcript-42',
          expectations: {
            transcriptId: 'transcript-42',
            expectedEntities: [],
            expectedTopics: [],
            expectedTensions: [],
            hypotheses: [],
            openQuestions: [],
            generatedAt: new Date().toISOString(),
          },
          findings: {
            foundEntities: [],
            foundTopics: [],
            foundTensions: [],
          },
          surprises: [{ type: 'unexpected_topic' as const, description: 'Found topic X', significance: 'high' as const }],
          confirmedHypotheses: [],
          refutedHypotheses: [],
          newQuestions: [],
        },
        lensResults: [],
      },
      dummyContext,
    );
    const insights = (result as any).insights;
    expect(insights[0].evidence).toContain('transcript-42');
  });
});
