import { Hono } from 'hono';
import {
  listTranscripts, getTranscript, getQuotesByTranscript,
} from '../../mastra/storage/index.js';

export const transcriptRoutes = new Hono();

transcriptRoutes.get('/', async (c) => {
  const persona = c.req.query('persona');
  const transcripts = await listTranscripts(persona);
  return c.json(transcripts);
});

transcriptRoutes.get('/:id', async (c) => {
  const transcript = await getTranscript(c.req.param('id'));
  if (!transcript) return c.json({ error: 'Transcript not found' }, 404);

  const quotes = await getQuotesByTranscript(transcript.id);
  return c.json({ ...transcript, quotes });
});
