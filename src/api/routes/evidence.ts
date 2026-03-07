import { Hono } from 'hono';
import {
  getEvidenceForTarget, getEvidenceByTranscript,
} from '../../mastra/storage/index.js';

export const evidenceRoutes = new Hono();

// Must come before /:targetType/:targetId to avoid 'transcript' matching as targetType
evidenceRoutes.get('/transcript/:id', async (c) => {
  const evidence = await getEvidenceByTranscript(c.req.param('id'));
  return c.json({ count: evidence.length, sources: evidence });
});

evidenceRoutes.get('/:targetType/:targetId', async (c) => {
  const evidence = await getEvidenceForTarget(
    c.req.param('targetType'),
    c.req.param('targetId'),
  );
  return c.json({ count: evidence.length, sources: evidence });
});
