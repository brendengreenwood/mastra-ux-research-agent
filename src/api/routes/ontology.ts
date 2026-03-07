import { Hono } from 'hono';
import {
  getFullOntology, getAllEntities, getEntity,
  getAllTensions, getAllTools,
} from '../../mastra/storage/index.js';

export const ontologyRoutes = new Hono();

ontologyRoutes.get('/', async (c) => {
  const ontology = await getFullOntology();
  return c.json(ontology);
});

ontologyRoutes.get('/entities', async (c) => {
  const entities = await getAllEntities();
  return c.json(entities);
});

ontologyRoutes.get('/entities/:id', async (c) => {
  const entity = await getEntity(c.req.param('id'));
  if (!entity) return c.json({ error: 'Entity not found' }, 404);
  return c.json(entity);
});

ontologyRoutes.get('/tensions', async (c) => {
  const tensions = await getAllTensions();
  return c.json(tensions);
});

ontologyRoutes.get('/tools', async (c) => {
  const tools = await getAllTools();
  return c.json(tools);
});
