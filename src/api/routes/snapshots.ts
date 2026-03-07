import { Hono } from 'hono';
import { listSnapshots, getSnapshot } from '../../mastra/storage/index.js';

export const snapshotRoutes = new Hono();

snapshotRoutes.get('/', async (c) => {
  const snapshots = await listSnapshots();
  return c.json(snapshots);
});

snapshotRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid snapshot ID' }, 400);

  const snapshot = await getSnapshot(id);
  if (!snapshot) return c.json({ error: 'Snapshot not found' }, 404);

  return c.json({
    ...snapshot,
    ontology: JSON.parse(snapshot.snapshot),
  });
});
