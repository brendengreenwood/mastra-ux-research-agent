import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const ExpectationFrame = z.object({
  transcriptId: z.string(),
  expectedEntities: z.array(z.string()),
  expectedTopics: z.array(z.string()),
  expectedTensions: z.array(z.string()),
  hypotheses: z.array(z.object({
    statement: z.string(),
    confidence: z.number().min(0).max(1),
    basis: z.string(),
  })),
  openQuestions: z.array(z.string()),
  generatedAt: z.string(),
});

const CapacityAssessment = z.object({
  transcriptId: z.string(),
  overallCapacity: z.enum(['high', 'medium', 'low']),
  ontologyDepth: z.object({
    entityCoverage: z.number().min(0).max(1),
    relationshipDensity: z.number().min(0).max(1),
    terminologyCoverage: z.number().min(0).max(1),
  }),
  recommendations: z.array(z.object({
    type: z.enum(['proceed', 'shallow_analysis', 'foundational_research', 'expert_consultation']),
    reason: z.string(),
  })),
  gaps: z.array(z.string()),
});

const AnalysisComparison = z.object({
  transcriptId: z.string(),
  expectations: ExpectationFrame,
  findings: z.object({
    foundEntities: z.array(z.string()),
    foundTopics: z.array(z.string()),
    foundTensions: z.array(z.string()),
  }),
  surprises: z.array(z.object({
    type: z.enum(['unexpected_entity', 'unexpected_topic', 'unexpected_tension', 'missing_expected', 'contradiction']),
    description: z.string(),
    significance: z.enum(['high', 'medium', 'low']),
  })),
  confirmedHypotheses: z.array(z.string()),
  refutedHypotheses: z.array(z.string()),
  newQuestions: z.array(z.string()),
});

export const generateExpectationsTool = createTool({
  id: 'generate-expectations',
  description: 'Generate expectation frame before analysis. Based on current ontology and transcript metadata, predict what findings to expect. Unexpected findings are where real insights live.',
  inputSchema: z.object({
    transcriptId: z.string(),
    transcriptTopics: z.array(z.string()),
    participantType: z.string().optional(),
    currentOntologyEntities: z.array(z.string()),
    currentOpenQuestions: z.array(z.string()),
  }),
  outputSchema: ExpectationFrame,
  execute: async ({ transcriptId, transcriptTopics, participantType, currentOntologyEntities, currentOpenQuestions }) => {
    const expectedEntities = currentOntologyEntities.filter(e =>
      transcriptTopics.some(t => t.toLowerCase().includes(e.toLowerCase()) ||
                                e.toLowerCase().includes(t.toLowerCase()))
    );

    const expectedTopics = transcriptTopics;

    const expectedTensions: string[] = [];
    if (transcriptTopics.includes('pricing') && transcriptTopics.includes('timing')) {
      expectedTensions.push('Price vs timing trade-off');
    }
    if (participantType === 'producer') {
      expectedTensions.push('Risk tolerance vs profit maximization');
    }

    const hypotheses = [
      {
        statement: `${participantType || 'Participant'} will reference known entities: ${expectedEntities.slice(0, 3).join(', ')}`,
        confidence: 0.7,
        basis: 'Common domain entities',
      },
    ];

    const relatedQuestions = currentOpenQuestions.filter(q =>
      transcriptTopics.some(t => q.toLowerCase().includes(t.toLowerCase()))
    );

    return {
      transcriptId,
      expectedEntities,
      expectedTopics,
      expectedTensions,
      hypotheses,
      openQuestions: relatedQuestions,
      generatedAt: new Date().toISOString(),
    };
  },
});

export const assessCapacityTool = createTool({
  id: 'assess-capacity',
  description: 'Assess the ontology capacity to meaningfully process incoming data. High capacity = deep analysis possible. Low capacity = shallow processing, flag for foundational research.',
  inputSchema: z.object({
    transcriptId: z.string(),
    transcriptTopics: z.array(z.string()),
    ontologyEntityCount: z.number(),
    ontologyEntities: z.array(z.string()),
    ontologyTerms: z.array(z.string()),
    ontologyRelationshipCount: z.number(),
  }),
  outputSchema: CapacityAssessment,
  execute: async ({ transcriptId, transcriptTopics, ontologyEntityCount, ontologyEntities, ontologyTerms, ontologyRelationshipCount }) => {
    const matchedEntities = transcriptTopics.filter(t =>
      ontologyEntities.some(e => e.toLowerCase().includes(t.toLowerCase()) ||
                                 t.toLowerCase().includes(e.toLowerCase()))
    );
    const entityCoverage = matchedEntities.length / Math.max(transcriptTopics.length, 1);

    const matchedTerms = transcriptTopics.filter(t =>
      ontologyTerms.some(term => term.toLowerCase().includes(t.toLowerCase()))
    );
    const terminologyCoverage = matchedTerms.length / Math.max(transcriptTopics.length, 1);

    const relationshipDensity = Math.min(ontologyRelationshipCount / Math.max(ontologyEntityCount * 2, 1), 1);

    let overallCapacity: 'high' | 'medium' | 'low';
    if (entityCoverage > 0.6 && terminologyCoverage > 0.5) {
      overallCapacity = 'high';
    } else if (entityCoverage > 0.3 || terminologyCoverage > 0.3) {
      overallCapacity = 'medium';
    } else {
      overallCapacity = 'low';
    }

    const recommendations: Array<{ type: 'proceed' | 'shallow_analysis' | 'foundational_research' | 'expert_consultation'; reason: string }> = [];
    const gaps: string[] = [];

    if (overallCapacity === 'high') {
      recommendations.push({ type: 'proceed', reason: 'Ontology has sufficient depth for comprehensive analysis' });
    } else if (overallCapacity === 'medium') {
      recommendations.push({ type: 'shallow_analysis', reason: 'Proceed with analysis but flag uncertain areas for follow-up' });
      gaps.push(...transcriptTopics.filter(t => !matchedEntities.includes(t) && !matchedTerms.includes(t)));
    } else {
      recommendations.push({ type: 'foundational_research', reason: 'Ontology lacks depth for these topics. Conduct foundational research first.' });
      recommendations.push({ type: 'expert_consultation', reason: 'Consider domain expert input before deep analysis' });
      gaps.push(...transcriptTopics);
    }

    return {
      transcriptId,
      overallCapacity,
      ontologyDepth: {
        entityCoverage,
        relationshipDensity,
        terminologyCoverage,
      },
      recommendations,
      gaps,
    };
  },
});

export const compareToExpectationsTool = createTool({
  id: 'compare-to-expectations',
  description: 'Compare analysis findings against expectations. Identify surprises, confirmations, and refutations. This is where insights emerge.',
  inputSchema: z.object({
    transcriptId: z.string(),
    expectations: ExpectationFrame,
    foundEntities: z.array(z.string()),
    foundTopics: z.array(z.string()),
    foundTensions: z.array(z.string()),
  }),
  outputSchema: AnalysisComparison,
  execute: async ({ transcriptId, expectations, foundEntities, foundTopics, foundTensions }) => {
    const surprises: Array<{ type: 'unexpected_entity' | 'unexpected_topic' | 'unexpected_tension' | 'missing_expected' | 'contradiction'; description: string; significance: 'high' | 'medium' | 'low' }> = [];

    const unexpectedEntities = foundEntities.filter(e =>
      !expectations.expectedEntities.some(exp => exp.toLowerCase() === e.toLowerCase())
    );
    for (const entity of unexpectedEntities) {
      surprises.push({
        type: 'unexpected_entity',
        description: `Found entity "${entity}" not in expectations`,
        significance: 'medium',
      });
    }

    const unexpectedTensions = foundTensions.filter(t =>
      !expectations.expectedTensions.some(exp => exp.toLowerCase().includes(t.toLowerCase()))
    );
    for (const tension of unexpectedTensions) {
      surprises.push({
        type: 'unexpected_tension',
        description: `Discovered tension: "${tension}"`,
        significance: 'high',
      });
    }

    const missingExpected = expectations.expectedEntities.filter(e =>
      !foundEntities.some(f => f.toLowerCase() === e.toLowerCase())
    );
    for (const missing of missingExpected) {
      surprises.push({
        type: 'missing_expected',
        description: `Expected entity "${missing}" not found in transcript`,
        significance: 'low',
      });
    }

    const confirmedHypotheses = expectations.hypotheses
      .filter(h => h.confidence > 0.5)
      .filter(h => {
        const mentioned = foundEntities.some(e => h.statement.toLowerCase().includes(e.toLowerCase()));
        return mentioned;
      })
      .map(h => h.statement);

    const refutedHypotheses = expectations.hypotheses
      .filter(h => h.confidence > 0.5)
      .filter(h => {
        const notMentioned = !foundEntities.some(e => h.statement.toLowerCase().includes(e.toLowerCase()));
        return notMentioned;
      })
      .map(h => h.statement);

    const newQuestions = surprises
      .filter(s => s.significance === 'high')
      .map(s => `Why did we find ${s.description}?`);

    return {
      transcriptId,
      expectations,
      findings: {
        foundEntities,
        foundTopics,
        foundTensions,
      },
      surprises,
      confirmedHypotheses,
      refutedHypotheses,
      newQuestions,
    };
  },
});

export const synthesizeInsightsTool = createTool({
  id: 'synthesize-insights',
  description: 'Synthesize analysis results into actionable insights and ontology updates',
  inputSchema: z.object({
    transcriptId: z.string(),
    comparison: AnalysisComparison,
    lensResults: z.array(z.object({
      lens: z.string(),
      keyFindings: z.array(z.string()),
    })),
  }),
  outputSchema: z.object({
    insights: z.array(z.object({
      insight: z.string(),
      confidence: z.number(),
      evidence: z.array(z.string()),
      actionable: z.boolean(),
    })),
    ontologyUpdates: z.array(z.object({
      type: z.enum(['add_entity', 'add_relationship', 'add_tension', 'resolve_question', 'add_terminology']),
      details: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    })),
    followUpResearch: z.array(z.string()),
  }),
  execute: async ({ transcriptId, comparison, lensResults }) => {
    const insights = comparison.surprises
      .filter(s => s.significance === 'high')
      .map(s => ({
        insight: s.description,
        confidence: 0.7,
        evidence: [transcriptId],
        actionable: true,
      }));

    const ontologyUpdates: Array<{ type: 'add_entity' | 'add_relationship' | 'add_tension' | 'resolve_question' | 'add_terminology'; details: string; priority: 'high' | 'medium' | 'low' }> = [];

    for (const surprise of comparison.surprises) {
      if (surprise.type === 'unexpected_entity') {
        ontologyUpdates.push({
          type: 'add_entity',
          details: surprise.description,
          priority: 'medium',
        });
      }
      if (surprise.type === 'unexpected_tension') {
        ontologyUpdates.push({
          type: 'add_tension',
          details: surprise.description,
          priority: 'high',
        });
      }
    }

    const followUpResearch = comparison.newQuestions;

    return {
      insights,
      ontologyUpdates,
      followUpResearch,
    };
  },
});
