import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ontologyRoutes } from './routes/ontology.js';
import { personaRoutes } from './routes/personas.js';
import { transcriptRoutes } from './routes/transcripts.js';
import { quoteRoutes } from './routes/quotes.js';
import { evidenceRoutes } from './routes/evidence.js';
import { snapshotRoutes } from './routes/snapshots.js';

export function createApp() {
  const app = new Hono();

  app.use('*', cors());

  // Ontology routes mounted at both /api/ontology and top-level /api
  app.route('/api/ontology', ontologyRoutes);
  app.route('/api', ontologyRoutes);

  app.route('/api/personas', personaRoutes);
  app.route('/api/transcripts', transcriptRoutes);
  app.route('/api/quotes', quoteRoutes);
  app.route('/api/evidence', evidenceRoutes);
  app.route('/api/snapshots', snapshotRoutes);

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  return app;
}
