import { Hono } from 'hono';
import {
  getQuotesByPersona, getQuotesByTopic, getQuotesByLens,
  searchQuotes,
} from '../../mastra/storage/index.js';
import { getDb } from '../../mastra/storage/index.js';

export const quoteRoutes = new Hono();

quoteRoutes.get('/', async (c) => {
  const persona = c.req.query('persona');
  const topic = c.req.query('topic');
  const lens = c.req.query('lens');

  if (persona) return c.json(await getQuotesByPersona(persona));
  if (topic) return c.json(await getQuotesByTopic(topic));
  if (lens) return c.json(await getQuotesByLens(lens));

  // Return all quotes
  const db = getDb();
  const rs = await db.execute('SELECT * FROM quotes ORDER BY id DESC');
  return c.json(rs.rows);
});

quoteRoutes.get('/search', async (c) => {
  const query = c.req.query('q') || '';
  if (!query) return c.json([]);
  return c.json(await searchQuotes(query));
});
