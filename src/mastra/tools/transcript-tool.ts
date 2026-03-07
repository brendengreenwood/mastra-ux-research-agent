import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  getTranscript, upsertTranscript, listTranscripts,
  type TranscriptRow,
} from '../storage/index.js';

export const Persona = z.enum([
  'merchant',
  'grain_origination_merchant',
  'csr',
  'strategic_account_rep',
]);

export type PersonaType = z.infer<typeof Persona>;

export const PERSONA_LABELS: Record<PersonaType, string> = {
  merchant: 'Merchant',
  grain_origination_merchant: 'Grain Origination Merchant',
  csr: 'Customer Service Rep',
  strategic_account_rep: 'Strategic Account Rep',
};

const ResearchClassification = z.object({
  dataType: z.enum(['attitudinal', 'behavioral']),
  methodology: z.enum(['qualitative', 'quantitative', 'mixed']),
  phase: z.enum(['discovery', 'definition', 'validation', 'iteration']),
  confidence: z.number().min(0).max(1),
});

const TranscriptMetadata = z.object({
  id: z.string(),
  source: z.string(),
  persona: Persona.describe('The role/persona of the participant'),
  participantId: z.string().optional().describe('Anonymous identifier for the participant'),
  context: z.string().optional(),
  date: z.string().optional(),
  duration: z.number().optional(),
});

const ProcessedTranscript = z.object({
  metadata: TranscriptMetadata,
  classification: ResearchClassification,
  rawContent: z.string(),
  segments: z.array(z.object({
    speaker: z.string(),
    content: z.string(),
    timestamp: z.string().optional(),
    topics: z.array(z.string()).optional(),
  })).optional(),
  extractedTopics: z.array(z.string()),
  keyQuotes: z.array(z.object({
    text: z.string(),
    speaker: z.string(),
    relevance: z.string(),
  })).optional(),
});

function transcriptRowToProcessed(row: TranscriptRow): z.infer<typeof ProcessedTranscript> {
  return {
    metadata: {
      id: row.id,
      source: row.source,
      persona: row.persona as PersonaType,
      participantId: row.participantId,
      context: row.context,
      date: row.date,
      duration: row.duration,
    },
    classification: row.classification as z.infer<typeof ResearchClassification>,
    rawContent: row.rawContent,
    segments: row.segments,
    extractedTopics: row.extractedTopics,
    keyQuotes: row.keyQuotes,
  };
}

export const ingestTranscriptTool = createTool({
  id: 'ingest-transcript',
  description: 'Ingest raw research data (transcript, field notes, session recording notes) and prepare for analysis',
  inputSchema: z.object({
    content: z.string().describe('Raw transcript or research notes content'),
    metadata: TranscriptMetadata,
  }),
  outputSchema: z.object({
    id: z.string(),
    wordCount: z.number(),
    estimatedSegments: z.number(),
    ready: z.boolean(),
  }),
  execute: async ({ content, metadata }) => {
    const wordCount = content.split(/\s+/).length;
    const estimatedSegments = content.split(/\n\n+/).length;

    const row: TranscriptRow = {
      id: metadata.id,
      source: metadata.source,
      persona: metadata.persona,
      participantId: metadata.participantId,
      context: metadata.context,
      date: metadata.date,
      duration: metadata.duration,
      classification: {
        dataType: 'attitudinal',
        methodology: 'qualitative',
        phase: 'discovery',
        confidence: 0.5,
      },
      rawContent: content,
      extractedTopics: [],
    };

    await upsertTranscript(row);

    return {
      id: metadata.id,
      wordCount,
      estimatedSegments,
      ready: true,
    };
  },
});

export const classifyTranscriptTool = createTool({
  id: 'classify-transcript',
  description: 'Classify research data by type (attitudinal/behavioral), methodology (qual/quant), and research phase. This is the "Motivation" step in cognitive processing.',
  inputSchema: z.object({
    transcriptId: z.string(),
    classification: ResearchClassification,
    reasoning: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    classification: ResearchClassification,
    processingRecommendation: z.string(),
  }),
  execute: async ({ transcriptId, classification }) => {
    const row = await getTranscript(transcriptId);
    if (!row) throw new Error(`Transcript ${transcriptId} not found`);

    row.classification = classification;
    await upsertTranscript(row);

    let recommendation = '';
    if (classification.dataType === 'attitudinal' && classification.methodology === 'qualitative') {
      recommendation = 'Deep thematic analysis recommended. Apply JTBD and Mental Model lenses.';
    } else if (classification.dataType === 'behavioral') {
      recommendation = 'Task flow analysis recommended. Apply Task Analysis lens.';
    } else if (classification.phase === 'discovery') {
      recommendation = 'Exploratory analysis. Apply OOUX lens to extract entities and relationships.';
    } else {
      recommendation = 'Validation analysis. Compare against existing ontology for confirmation or contradiction.';
    }

    return {
      success: true,
      classification,
      processingRecommendation: recommendation,
    };
  },
});

export const extractTopicsTool = createTool({
  id: 'extract-topics',
  description: 'Extract main topics and themes from transcript content',
  inputSchema: z.object({
    transcriptId: z.string(),
    topics: z.array(z.string()),
    keyQuotes: z.array(z.object({
      text: z.string(),
      speaker: z.string(),
      relevance: z.string(),
    })).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    topicCount: z.number(),
    quoteCount: z.number(),
  }),
  execute: async ({ transcriptId, topics, keyQuotes }) => {
    const row = await getTranscript(transcriptId);
    if (!row) throw new Error(`Transcript ${transcriptId} not found`);

    row.extractedTopics = topics;
    row.keyQuotes = keyQuotes;
    await upsertTranscript(row);

    return {
      success: true,
      topicCount: topics.length,
      quoteCount: keyQuotes?.length || 0,
    };
  },
});

export const getTranscriptTool = createTool({
  id: 'get-transcript',
  description: 'Retrieve a processed transcript by ID',
  inputSchema: z.object({
    transcriptId: z.string(),
  }),
  outputSchema: ProcessedTranscript,
  execute: async ({ transcriptId }) => {
    const row = await getTranscript(transcriptId);
    if (!row) throw new Error(`Transcript ${transcriptId} not found`);
    return transcriptRowToProcessed(row);
  },
});

export const listTranscriptsTool = createTool({
  id: 'list-transcripts',
  description: 'List all ingested transcripts with their classifications. Can filter by persona.',
  inputSchema: z.object({
    filterByPersona: Persona.optional().describe('Filter transcripts to a specific persona'),
  }),
  outputSchema: z.object({
    count: z.number(),
    transcripts: z.array(z.object({
      id: z.string(),
      source: z.string(),
      persona: Persona,
      personaLabel: z.string(),
      classification: ResearchClassification,
      topicCount: z.number(),
    })),
  }),
  execute: async ({ filterByPersona }) => {
    const rows = await listTranscripts(filterByPersona);

    const result = rows.map(t => ({
      id: t.id,
      source: t.source,
      persona: t.persona as PersonaType,
      personaLabel: PERSONA_LABELS[t.persona as PersonaType],
      classification: t.classification as z.infer<typeof ResearchClassification>,
      topicCount: t.extractedTopics.length,
    }));
    return { count: result.length, transcripts: result };
  },
});
