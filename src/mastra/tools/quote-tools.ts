import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  addQuote, addQuotes,
  getQuotesByTranscript, getQuotesByPersona, getQuotesByTopic, getQuotesByLens,
  searchQuotes,
  type Quote,
} from '../storage/index.js';

const QuoteOutput = z.object({
  id: z.number().optional(),
  transcriptId: z.string(),
  text: z.string(),
  speaker: z.string(),
  persona: z.string(),
  topic: z.string().optional(),
  sentiment: z.string().optional(),
  lensType: z.string().optional(),
  relevance: z.string().optional(),
  createdAt: z.string().optional(),
});

export const addQuoteTool = createTool({
  id: 'add-quote',
  description: 'Add a notable quote from a transcript to the quote bank.',
  inputSchema: z.object({
    transcriptId: z.string(),
    text: z.string().describe('The exact quote text'),
    speaker: z.string().describe('Who said it'),
    persona: z.string().describe('Persona type of the speaker'),
    topic: z.string().optional().describe('Primary topic this quote relates to'),
    sentiment: z.string().optional().describe('Sentiment: positive, negative, neutral, frustrated, enthusiastic'),
    lensType: z.string().optional().describe('Which analysis lens surfaced this quote'),
    relevance: z.string().optional().describe('Why this quote is notable'),
  }),
  outputSchema: z.object({
    quoteId: z.number(),
    message: z.string(),
  }),
  execute: async (input) => {
    const id = await addQuote(input);
    return { quoteId: id, message: `Quote saved to bank (ID: ${id})` };
  },
});

export const batchAddQuotesTool = createTool({
  id: 'batch-add-quotes',
  description: 'Add multiple quotes from a transcript to the quote bank at once.',
  inputSchema: z.object({
    quotes: z.array(z.object({
      transcriptId: z.string(),
      text: z.string(),
      speaker: z.string(),
      persona: z.string(),
      topic: z.string().optional(),
      sentiment: z.string().optional(),
      lensType: z.string().optional(),
      relevance: z.string().optional(),
    })),
  }),
  outputSchema: z.object({
    savedCount: z.number(),
    message: z.string(),
  }),
  execute: async ({ quotes }) => {
    const count = await addQuotes(quotes);
    return { savedCount: count, message: `${count} quotes saved to bank` };
  },
});

export const queryQuotesTool = createTool({
  id: 'query-quotes',
  description: 'Search the quote bank by persona, topic, lens type, transcript, or free text.',
  inputSchema: z.object({
    filterBy: z.enum(['persona', 'topic', 'lens', 'transcript', 'search']).describe('What to filter by'),
    value: z.string().describe('The filter value'),
  }),
  outputSchema: z.object({
    count: z.number(),
    quotes: z.array(QuoteOutput),
  }),
  execute: async ({ filterBy, value }) => {
    let quotes: Quote[];
    switch (filterBy) {
      case 'persona':
        quotes = await getQuotesByPersona(value);
        break;
      case 'topic':
        quotes = await getQuotesByTopic(value);
        break;
      case 'lens':
        quotes = await getQuotesByLens(value);
        break;
      case 'transcript':
        quotes = await getQuotesByTranscript(value);
        break;
      case 'search':
        quotes = await searchQuotes(value);
        break;
    }
    return { count: quotes.length, quotes };
  },
});
