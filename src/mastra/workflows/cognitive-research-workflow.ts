import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { Persona, PERSONA_LABELS } from '../tools/transcript-tool';

const TranscriptInput = z.object({
  content: z.string().describe('Raw transcript or research notes'),
  source: z.string().describe('Where this data came from'),
  persona: Persona.describe('Role of the participant'),
  participantId: z.string().optional().describe('Anonymous identifier'),
  context: z.string().optional().describe('Additional context about the session'),
});

const ClassificationSchema = z.object({
  dataType: z.enum(['attitudinal', 'behavioral']),
  methodology: z.enum(['qualitative', 'quantitative', 'mixed']),
  phase: z.enum(['discovery', 'definition', 'validation', 'iteration']),
});

const ProposedEntityUpdate = z.object({
  entityId: z.string(),
  entityName: z.string(),
  updateType: z.enum(['add_entity', 'add_perspective', 'update_perspective', 'add_relationship']),
  persona: z.string(),
  details: z.record(z.string(), z.unknown()),
  confidence: z.enum(['high', 'medium', 'low']),
  evidence: z.array(z.string()),
});

const ProposedTension = z.object({
  id: z.string(),
  description: z.string(),
  tensionType: z.enum(['intra-role', 'inter-role', 'system']),
  roles: z.array(z.string()),
  entities: z.array(z.string()),
  implications: z.string(),
  evidence: z.array(z.string()),
});

const SynthesisResult = z.object({
  transcriptId: z.string(),
  persona: z.string(),
  personaLabel: z.string(),
  classification: ClassificationSchema,
  lensesApplied: z.array(z.string()),
  insights: z.array(z.object({
    insight: z.string(),
    significance: z.enum(['high', 'medium', 'low']),
    type: z.enum(['confirmation', 'surprise', 'contradiction']),
  })),
  proposedEntityUpdates: z.array(ProposedEntityUpdate),
  proposedTensions: z.array(ProposedTension),
  followUpQuestions: z.array(z.string()),
});

const ReviewDecision = z.object({
  approved: z.boolean(),
  approvedEntityUpdates: z.array(z.string()).describe('IDs of approved entity updates'),
  approvedTensions: z.array(z.string()).describe('IDs of approved tensions'),
  rejectionReasons: z.record(z.string(), z.string()).optional(),
  notes: z.string().optional(),
});

const ingestStep = createStep({
  id: 'ingest-transcript',
  description: 'Ingest and prepare transcript with persona tagging',
  inputSchema: TranscriptInput,
  outputSchema: z.object({
    transcriptId: z.string(),
    wordCount: z.number(),
    persona: z.string(),
    personaLabel: z.string(),
    topics: z.array(z.string()),
    content: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Input data required');

    const transcriptId = `transcript-${inputData.persona}-${Date.now()}`;
    const wordCount = inputData.content.split(/\s+/).length;

    const topicKeywords = [
      'pricing', 'basis', 'futures', 'contract', 'elevator', 'delivery',
      'hedge', 'risk', 'market', 'timing', 'storage', 'quality', 'grade',
      'producer', 'customer', 'account', 'relationship', 'position',
    ];
    const contentLower = inputData.content.toLowerCase();
    const topics = topicKeywords.filter(kw => contentLower.includes(kw));

    return {
      transcriptId,
      wordCount,
      persona: inputData.persona,
      personaLabel: PERSONA_LABELS[inputData.persona],
      topics,
      content: inputData.content,
    };
  },
});

const classifyStep = createStep({
  id: 'classify-research',
  description: 'Classify research data by type and methodology',
  inputSchema: z.object({
    transcriptId: z.string(),
    wordCount: z.number(),
    persona: z.string(),
    personaLabel: z.string(),
    topics: z.array(z.string()),
    content: z.string(),
  }),
  outputSchema: z.object({
    transcriptId: z.string(),
    persona: z.string(),
    personaLabel: z.string(),
    classification: ClassificationSchema,
    topics: z.array(z.string()),
    recommendedLenses: z.array(z.string()),
    content: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Input data required');

    const classification: z.infer<typeof ClassificationSchema> = {
      dataType: 'attitudinal',
      methodology: 'qualitative',
      phase: 'discovery',
    };

    if (inputData.topics.some(t => ['timing', 'delivery', 'contract', 'position'].includes(t))) {
      classification.dataType = 'behavioral';
    }

    let recommendedLenses: string[] = [];
    if (classification.phase === 'discovery') {
      recommendedLenses = ['OOUX', 'MentalModel'];
    } else if (classification.dataType === 'behavioral') {
      recommendedLenses = ['Activity', 'TaskAnalysis'];
    } else {
      recommendedLenses = ['JTBD', 'MentalModel'];
    }

    return {
      transcriptId: inputData.transcriptId,
      persona: inputData.persona,
      personaLabel: inputData.personaLabel,
      classification,
      topics: inputData.topics,
      recommendedLenses,
      content: inputData.content,
    };
  },
});

const synthesizeStep = createStep({
  id: 'synthesize-findings',
  description: 'Synthesize analysis into proposed ontology updates',
  inputSchema: z.object({
    transcriptId: z.string(),
    persona: z.string(),
    personaLabel: z.string(),
    classification: ClassificationSchema,
    topics: z.array(z.string()),
    recommendedLenses: z.array(z.string()),
    content: z.string(),
  }),
  outputSchema: SynthesisResult,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Input data required');

    const insights: z.infer<typeof SynthesisResult>['insights'] = [];
    const proposedEntityUpdates: z.infer<typeof ProposedEntityUpdate>[] = [];
    const proposedTensions: z.infer<typeof ProposedTension>[] = [];

    if (inputData.topics.includes('contract')) {
      proposedEntityUpdates.push({
        entityId: 'contract',
        entityName: 'Contract',
        updateType: 'add_perspective',
        persona: inputData.persona,
        details: {
          primaryConcern: `Extracted from ${inputData.personaLabel} transcript`,
          evidence: [inputData.transcriptId],
        },
        confidence: 'medium',
        evidence: [inputData.transcriptId],
      });
    }

    for (const topic of inputData.topics) {
      if (!['contract', 'producer', 'elevator', 'basis', 'futures'].includes(topic)) {
        proposedEntityUpdates.push({
          entityId: topic.toLowerCase().replace(/\s+/g, '-'),
          entityName: topic.charAt(0).toUpperCase() + topic.slice(1),
          updateType: 'add_entity',
          persona: inputData.persona,
          details: {
            type: 'concept',
            discoveredFrom: inputData.personaLabel,
          },
          confidence: 'low',
          evidence: [inputData.transcriptId],
        });

        insights.push({
          insight: `New topic "${topic}" discovered in ${inputData.personaLabel} data`,
          significance: 'medium',
          type: 'surprise',
        });
      }
    }

    if (inputData.topics.includes('pricing') && inputData.topics.includes('timing')) {
      insights.push({
        insight: `${inputData.personaLabel} shows strong connection between pricing decisions and timing`,
        significance: 'high',
        type: 'confirmation',
      });
    }

    const followUpQuestions = [
      `How does ${inputData.personaLabel}'s view of contracts compare to other roles?`,
      `What specific terminology does ${inputData.personaLabel} use that differs from system terminology?`,
    ];

    return {
      transcriptId: inputData.transcriptId,
      persona: inputData.persona,
      personaLabel: inputData.personaLabel,
      classification: inputData.classification,
      lensesApplied: inputData.recommendedLenses,
      insights,
      proposedEntityUpdates,
      proposedTensions,
      followUpQuestions,
    };
  },
});

const humanReviewStep = createStep({
  id: 'human-review',
  description: 'Pause for human review of proposed ontology updates',
  inputSchema: SynthesisResult,
  outputSchema: z.object({
    synthesis: SynthesisResult,
    decision: ReviewDecision,
  }),
  resumeSchema: ReviewDecision,
  suspendSchema: z.object({
    message: z.string(),
    synthesis: SynthesisResult,
    entityUpdateCount: z.number(),
    tensionCount: z.number(),
    insightCount: z.number(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!inputData) throw new Error('Input data required');

    if (!resumeData) {
      return await suspend({
        message: `Review proposed updates from ${inputData.personaLabel} transcript analysis`,
        synthesis: inputData,
        entityUpdateCount: inputData.proposedEntityUpdates.length,
        tensionCount: inputData.proposedTensions.length,
        insightCount: inputData.insights.length,
      });
    }

    return {
      synthesis: inputData,
      decision: resumeData,
    };
  },
});

const persistStep = createStep({
  id: 'persist-updates',
  description: 'Persist approved ontology updates',
  inputSchema: z.object({
    synthesis: SynthesisResult,
    decision: ReviewDecision,
  }),
  outputSchema: z.object({
    success: z.boolean(),
    persistedEntities: z.number(),
    persistedTensions: z.number(),
    skippedUpdates: z.number(),
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Input data required');

    const { synthesis, decision } = inputData;

    if (!decision.approved) {
      return {
        success: true,
        persistedEntities: 0,
        persistedTensions: 0,
        skippedUpdates: synthesis.proposedEntityUpdates.length + synthesis.proposedTensions.length,
        summary: `Review rejected. Reason: ${decision.notes || 'No reason provided'}`,
      };
    }

    const approvedEntities = synthesis.proposedEntityUpdates.filter(
      e => decision.approvedEntityUpdates.includes(e.entityId)
    );
    const approvedTensions = synthesis.proposedTensions.filter(
      t => decision.approvedTensions.includes(t.id)
    );

    const skipped =
      (synthesis.proposedEntityUpdates.length - approvedEntities.length) +
      (synthesis.proposedTensions.length - approvedTensions.length);

    return {
      success: true,
      persistedEntities: approvedEntities.length,
      persistedTensions: approvedTensions.length,
      skippedUpdates: skipped,
      summary: `Persisted ${approvedEntities.length} entity updates and ${approvedTensions.length} tensions from ${synthesis.personaLabel} analysis.${decision.notes ? ` Notes: ${decision.notes}` : ''}`,
    };
  },
});

const cognitiveResearchWorkflow = createWorkflow({
  id: 'cognitive-research-workflow',
  inputSchema: TranscriptInput,
  outputSchema: z.object({
    success: z.boolean(),
    persistedEntities: z.number(),
    persistedTensions: z.number(),
    skippedUpdates: z.number(),
    summary: z.string(),
  }),
})
  .then(ingestStep)
  .then(classifyStep)
  .then(synthesizeStep)
  .then(humanReviewStep)
  .then(persistStep);

cognitiveResearchWorkflow.commit();

export { cognitiveResearchWorkflow, humanReviewStep };
