import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { PERSONA_LABELS, type PersonaType } from './transcript-tool';
import {
  getAllEntities, getAllTensions, getAllTools,
  getQuotesByPersona,
  listTranscripts,
} from '../storage/index.js';

export const generatePersonaProfileTool = createTool({
  id: 'generate-persona-profile',
  description: 'Generate a comprehensive persona profile document synthesizing all research data for a specific role — entities, tensions, tool usage, quotes, and perspectives.',
  inputSchema: z.object({
    persona: z.enum(['merchant', 'grain_origination_merchant', 'csr', 'strategic_account_rep'])
      .describe('The persona to generate a profile for'),
  }),
  outputSchema: z.object({
    persona: z.string(),
    label: z.string(),
    profile: z.object({
      overview: z.object({
        totalEntitiesReferenced: z.number(),
        totalTensionsFacing: z.number(),
        totalToolsUsed: z.number(),
        totalQuotes: z.number(),
        transcriptsAnalyzed: z.number(),
      }),
      coreEntities: z.array(z.object({
        name: z.string(),
        type: z.string(),
        primaryConcern: z.string().optional(),
        painPoints: z.array(z.string()),
        terminology: z.array(z.string()),
      })),
      tensions: z.array(z.object({
        description: z.string(),
        tensionType: z.string(),
        implications: z.array(z.string()),
      })),
      toolEcosystem: z.array(z.object({
        name: z.string(),
        category: z.string(),
        frequency: z.string().optional(),
        proficiency: z.string().optional(),
        sentiment: z.string().optional(),
        painPoints: z.array(z.string()),
        workarounds: z.array(z.string()),
      })),
      topQuotes: z.array(z.object({
        text: z.string(),
        topic: z.string().optional(),
        sentiment: z.string().optional(),
      })),
      dayInTheLife: z.string(),
    }),
  }),
  execute: async ({ persona }) => {
    const label = PERSONA_LABELS[persona as PersonaType] || persona;

    // Gather all data for this persona
    const [entities, tensions, tools, quotes, transcripts] = await Promise.all([
      getAllEntities(),
      getAllTensions(),
      getAllTools(),
      getQuotesByPersona(persona),
      listTranscripts(persona),
    ]);

    // Filter entities that have perspectives for this persona
    const relevantEntities = entities.filter(e =>
      e.perspectives && persona in e.perspectives
    );

    const coreEntities = relevantEntities.map(e => {
      const perspective = e.perspectives?.[persona as PersonaType];
      return {
        name: e.name,
        type: e.type,
        primaryConcern: perspective?.primaryConcern,
        painPoints: perspective?.painPoints || [],
        terminology: perspective?.terminology || [],
      };
    });

    // Filter tensions involving this persona
    const relevantTensions = tensions.filter(t =>
      t.roles?.includes(persona)
    );

    const tensionSummaries = relevantTensions.map(t => ({
      description: t.description,
      tensionType: t.tensionType,
      implications: t.implications ? [t.implications] : [],
    }));

    // Filter tools used by this persona
    const relevantTools = tools.filter(t =>
      t.usageByPersona && persona in t.usageByPersona
    );

    const toolEcosystem = relevantTools.map(t => {
      const usage = t.usageByPersona?.[persona as PersonaType];
      return {
        name: t.name,
        category: t.category,
        frequency: usage?.frequency,
        proficiency: usage?.proficiency,
        sentiment: usage?.sentiment,
        painPoints: usage?.painPoints || [],
        workarounds: usage?.workarounds || [],
      };
    });

    // Top quotes (take first 10)
    const topQuotes = quotes.slice(0, 10).map(q => ({
      text: q.text,
      topic: q.topic,
      sentiment: q.sentiment,
    }));

    // Generate a "Day in the Life" narrative
    const allPainPoints = coreEntities.flatMap(e => e.painPoints);
    const allWorkarounds = toolEcosystem.flatMap(t => t.workarounds);
    const toolNames = toolEcosystem.map(t => t.name);
    const tensionDescriptions = tensionSummaries.map(t => t.description);

    let dayInTheLife = `## A Day in the Life of a ${label}\n\n`;
    dayInTheLife += `The ${label} works across ${coreEntities.length} key domain areas`;

    if (toolNames.length > 0) {
      dayInTheLife += `, using tools like ${toolNames.slice(0, 3).join(', ')}`;
      if (toolNames.length > 3) dayInTheLife += ` and ${toolNames.length - 3} others`;
    }
    dayInTheLife += '.\n\n';

    if (allPainPoints.length > 0) {
      dayInTheLife += `### Key Frustrations\n`;
      const uniquePains = [...new Set(allPainPoints)].slice(0, 5);
      uniquePains.forEach(p => { dayInTheLife += `- ${p}\n`; });
      dayInTheLife += '\n';
    }

    if (tensionDescriptions.length > 0) {
      dayInTheLife += `### Tensions They Navigate\n`;
      tensionDescriptions.slice(0, 3).forEach(t => { dayInTheLife += `- ${t}\n`; });
      dayInTheLife += '\n';
    }

    if (allWorkarounds.length > 0) {
      dayInTheLife += `### Workarounds They've Developed\n`;
      const uniqueWorkarounds = [...new Set(allWorkarounds)].slice(0, 5);
      uniqueWorkarounds.forEach(w => { dayInTheLife += `- ${w}\n`; });
      dayInTheLife += '\n';
    }

    if (topQuotes.length > 0) {
      dayInTheLife += `### In Their Own Words\n`;
      topQuotes.slice(0, 3).forEach(q => {
        dayInTheLife += `> "${q.text}"\n\n`;
      });
    }

    return {
      persona,
      label,
      profile: {
        overview: {
          totalEntitiesReferenced: relevantEntities.length,
          totalTensionsFacing: relevantTensions.length,
          totalToolsUsed: relevantTools.length,
          totalQuotes: quotes.length,
          transcriptsAnalyzed: transcripts.length,
        },
        coreEntities,
        tensions: tensionSummaries,
        toolEcosystem,
        topQuotes,
        dayInTheLife,
      },
    };
  },
});
