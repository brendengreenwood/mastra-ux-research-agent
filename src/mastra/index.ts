
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';
import { cognitiveResearchWorkflow } from './workflows/cognitive-research-workflow';
import { researchAgent } from './agents/research-agent';
import { initDb, seedIfEmpty } from './storage/index';

// Initialize research database (creates tables, seeds default ontology)
const dbReady = initDb().then(() => seedIfEmpty());
dbReady.catch(err => console.error('Failed to initialize research database:', err));

export { dbReady };

export const mastra = new Mastra({
  workflows: { cognitiveResearchWorkflow },
  agents: { researchAgent },
  storage: new LibSQLStore({
    id: "mastra-storage",
    // stores observability, scores, ... into persistent file storage
    url: "file:./mastra.db",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to local storage for Mastra Studio
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
