import { Hono } from 'hono';
import {
  getAllEntities, getAllTensions, getAllTools,
  getQuotesByPersona, listTranscripts,
  type PersonaType,
} from '../../mastra/storage/index.js';

const PERSONAS: Array<{ id: PersonaType; label: string }> = [
  { id: 'merchant', label: 'Merchant' },
  { id: 'grain_origination_merchant', label: 'Grain Origination Merchant' },
  { id: 'csr', label: 'Customer Service Rep' },
  { id: 'strategic_account_rep', label: 'Strategic Account Rep' },
];

export const personaRoutes = new Hono();

personaRoutes.get('/', async (c) => {
  const [entities, tensions, tools] = await Promise.all([
    getAllEntities(), getAllTensions(), getAllTools(),
  ]);

  const personas = PERSONAS.map((p) => {
    const entityCount = entities.filter(e => e.perspectives && p.id in e.perspectives).length;
    const tensionCount = tensions.filter(t => t.roles?.includes(p.id)).length;
    const toolCount = tools.filter(t => t.usageByPersona && p.id in t.usageByPersona).length;
    return { ...p, entityCount, tensionCount, toolCount };
  });

  return c.json(personas);
});

personaRoutes.get('/:persona/profile', async (c) => {
  const personaId = c.req.param('persona') as PersonaType;
  const persona = PERSONAS.find(p => p.id === personaId);
  if (!persona) return c.json({ error: 'Persona not found' }, 404);

  const [entities, tensions, tools, quotes, transcripts] = await Promise.all([
    getAllEntities(), getAllTensions(), getAllTools(),
    getQuotesByPersona(personaId), listTranscripts(personaId),
  ]);

  const relevantEntities = entities.filter(e => e.perspectives && personaId in e.perspectives);
  const coreEntities = relevantEntities.map(e => {
    const perspective = e.perspectives?.[personaId];
    return {
      name: e.name, type: e.type,
      primaryConcern: perspective?.primaryConcern,
      painPoints: perspective?.painPoints || [],
      terminology: perspective?.terminology || [],
    };
  });

  const relevantTensions = tensions.filter(t => t.roles?.includes(personaId));
  const tensionSummaries = relevantTensions.map(t => ({
    description: t.description, tensionType: t.tensionType,
    implications: t.implications ? [t.implications] : [],
  }));

  const relevantTools = tools.filter(t => t.usageByPersona && personaId in t.usageByPersona);
  const toolUsage = relevantTools.map(t => {
    const usage = t.usageByPersona?.[personaId];
    return {
      name: t.name, category: t.category,
      frequency: usage?.frequency, proficiency: usage?.proficiency,
      sentiment: usage?.sentiment,
      painPoints: usage?.painPoints || [],
      workarounds: usage?.workarounds || [],
    };
  });

  const topQuotes = quotes.slice(0, 10).map(q => ({
    text: q.text, topic: q.topic, sentiment: q.sentiment,
  }));

  const allPainPoints = [...new Set(coreEntities.flatMap(e => e.painPoints))].slice(0, 5);
  const toolNames = toolUsage.map(t => t.name);
  let dayInTheLife = `The ${persona.label} works across ${coreEntities.length} key domain areas`;
  if (toolNames.length > 0) {
    dayInTheLife += `, using tools like ${toolNames.slice(0, 3).join(', ')}`;
    if (toolNames.length > 3) dayInTheLife += ` and ${toolNames.length - 3} others`;
  }
  dayInTheLife += '.';
  if (allPainPoints.length > 0) {
    dayInTheLife += ` Key frustrations: ${allPainPoints.join('; ')}.`;
  }

  return c.json({
    ...persona,
    profile: {
      overview: {
        totalEntitiesReferenced: relevantEntities.length,
        totalTensionsFacing: relevantTensions.length,
        totalToolsUsed: relevantTools.length,
        totalQuotes: quotes.length,
        transcriptsAnalyzed: transcripts.length,
      },
      coreEntities, tensions: tensionSummaries, toolUsage, topQuotes, dayInTheLife,
    },
  });
});
