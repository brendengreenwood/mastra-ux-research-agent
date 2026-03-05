import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const TranscriptInput = z.object({
  content: z.string(),
  source: z.string(),
  participantType: z.string().optional(),
  context: z.string().optional(),
});

const ClassificationSchema = z.object({
  dataType: z.enum(['attitudinal', 'behavioral']),
  methodology: z.enum(['qualitative', 'quantitative', 'mixed']),
  phase: z.enum(['discovery', 'definition', 'validation', 'iteration']),
});

const AnalysisResultSchema = z.object({
  transcriptId: z.string(),
  classification: ClassificationSchema,
  capacity: z.enum(['high', 'medium', 'low']),
  lensesApplied: z.array(z.string()),
  insights: z.array(z.object({
    insight: z.string(),
    significance: z.enum(['high', 'medium', 'low']),
  })),
  surprises: z.array(z.string()),
  ontologyUpdates: z.array(z.string()),
  followUpResearch: z.array(z.string()),
});

const ingestStep = createStep({
  id: 'ingest-transcript',
  description: 'Ingest and prepare transcript for analysis',
  inputSchema: TranscriptInput,
  outputSchema: z.object({
    transcriptId: z.string(),
    wordCount: z.number(),
    topics: z.array(z.string()),
    participantType: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Input data required');

    const transcriptId = `transcript-${Date.now()}`;
    const wordCount = inputData.content.split(/\s+/).length;

    const topicKeywords = [
      'pricing', 'basis', 'futures', 'contract', 'elevator', 'delivery',
      'hedge', 'risk', 'market', 'timing', 'storage', 'quality', 'grade',
    ];
    const contentLower = inputData.content.toLowerCase();
    const topics = topicKeywords.filter(kw => contentLower.includes(kw));

    return {
      transcriptId,
      wordCount,
      topics,
      participantType: inputData.participantType || 'unknown',
    };
  },
});

const classifyStep = createStep({
  id: 'classify-research',
  description: 'Classify research data by type and methodology',
  inputSchema: z.object({
    transcriptId: z.string(),
    wordCount: z.number(),
    topics: z.array(z.string()),
    participantType: z.string(),
  }),
  outputSchema: z.object({
    transcriptId: z.string(),
    classification: ClassificationSchema,
    topics: z.array(z.string()),
    participantType: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Input data required');

    const classification: z.infer<typeof ClassificationSchema> = {
      dataType: 'attitudinal',
      methodology: 'qualitative',
      phase: 'discovery',
    };

    if (inputData.topics.some(t => ['timing', 'delivery', 'contract'].includes(t))) {
      classification.dataType = 'behavioral';
    }

    return {
      transcriptId: inputData.transcriptId,
      classification,
      topics: inputData.topics,
      participantType: inputData.participantType,
    };
  },
});

const assessCapacityStep = createStep({
  id: 'assess-capacity',
  description: 'Assess ontology capacity for processing this data',
  inputSchema: z.object({
    transcriptId: z.string(),
    classification: ClassificationSchema,
    topics: z.array(z.string()),
    participantType: z.string(),
  }),
  outputSchema: z.object({
    transcriptId: z.string(),
    classification: ClassificationSchema,
    topics: z.array(z.string()),
    participantType: z.string(),
    capacity: z.enum(['high', 'medium', 'low']),
    gaps: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Input data required');

    const knownEntities = ['producer', 'elevator', 'contract', 'basis', 'futures'];
    const matchedTopics = inputData.topics.filter(t =>
      knownEntities.some(e => e.includes(t) || t.includes(e))
    );

    let capacity: 'high' | 'medium' | 'low';
    if (matchedTopics.length / inputData.topics.length > 0.6) {
      capacity = 'high';
    } else if (matchedTopics.length > 0) {
      capacity = 'medium';
    } else {
      capacity = 'low';
    }

    const gaps = inputData.topics.filter(t => !matchedTopics.includes(t));

    return {
      ...inputData,
      capacity,
      gaps,
    };
  },
});

const analyzeWithAgentStep = createStep({
  id: 'agent-analysis',
  description: 'Use research agent to apply appropriate lenses and analyze',
  inputSchema: z.object({
    transcriptId: z.string(),
    classification: ClassificationSchema,
    topics: z.array(z.string()),
    participantType: z.string(),
    capacity: z.enum(['high', 'medium', 'low']),
    gaps: z.array(z.string()),
  }),
  outputSchema: AnalysisResultSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Input data required');

    const agent = mastra?.getAgent('researchAgent');

    let lensesApplied: string[] = [];
    if (inputData.classification.phase === 'discovery') {
      lensesApplied = ['OOUX', 'MentalModel'];
    } else if (inputData.classification.dataType === 'behavioral') {
      lensesApplied = ['TaskAnalysis', 'JTBD'];
    } else {
      lensesApplied = ['JTBD', 'MentalModel'];
    }

    const insights: Array<{ insight: string; significance: 'high' | 'medium' | 'low' }> = [];
    const surprises: string[] = [];
    const ontologyUpdates: string[] = [];

    if (inputData.topics.includes('pricing') && inputData.topics.includes('timing')) {
      insights.push({
        insight: 'Pricing decisions are heavily time-sensitive for this participant',
        significance: 'high',
      });
    }

    if (inputData.gaps.length > 0) {
      surprises.push(`Found topics not in ontology: ${inputData.gaps.join(', ')}`);
      for (const gap of inputData.gaps) {
        ontologyUpdates.push(`Consider adding entity: ${gap}`);
      }
    }

    const followUpResearch = inputData.capacity === 'low'
      ? ['Conduct foundational research on: ' + inputData.gaps.join(', ')]
      : [];

    return {
      transcriptId: inputData.transcriptId,
      classification: inputData.classification,
      capacity: inputData.capacity,
      lensesApplied,
      insights,
      surprises,
      ontologyUpdates,
      followUpResearch,
    };
  },
});

const researchAnalysisWorkflow = createWorkflow({
  id: 'research-analysis-workflow',
  inputSchema: TranscriptInput,
  outputSchema: AnalysisResultSchema,
})
  .then(ingestStep)
  .then(classifyStep)
  .then(assessCapacityStep)
  .then(analyzeWithAgentStep);

researchAnalysisWorkflow.commit();

export { researchAnalysisWorkflow };
