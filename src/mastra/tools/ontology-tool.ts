import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Persona, type PersonaType, PERSONA_LABELS } from './transcript-tool';
import {
  getAllEntities, getEntity, upsertEntity,
  getAllTensions, upsertTension,
  getOpenQuestions, removeOpenQuestion,
  getTerminology, upsertTerm,
  getAllTools, getTool, upsertTool,
  getAllPocFeatures, upsertPocFeature,
  getDomain, getLastUpdated, getFullOntology,
  updateEntityPerspective,
  getEvidenceForTarget, getEvidenceByTranscript,
  takeSnapshot, getSnapshot, listSnapshots, getLatestSnapshot,
  type EntityRow, type TensionRow, type ToolRow, type PocFeatureRow, type RolePerspective, type ToolUsage,
} from '../storage/index.js';

const RolePerspectiveSchema = z.object({
  primaryConcern: z.string().describe('What this role cares most about regarding this entity'),
  mentalModel: z.string().optional().describe('How this role conceptualizes this entity'),
  terminology: z.array(z.string()).optional().describe('Terms this role uses for this entity'),
  painPoints: z.array(z.string()).optional().describe('Frustrations this role has with this entity'),
  workflows: z.array(z.string()).optional().describe('How this role interacts with this entity'),
  evidence: z.array(z.string()).optional().describe('Transcript IDs supporting this perspective'),
});

const ToolUsageSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'rarely', 'never']),
  proficiency: z.enum(['expert', 'proficient', 'basic', 'struggling']).optional(),
  sentiment: z.enum(['love', 'like', 'neutral', 'dislike', 'hate']).optional(),
  painPoints: z.array(z.string()).optional(),
  workarounds: z.array(z.string()).optional(),
  wishlist: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
});

const ToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum([
    'pricing', 'contracts', 'logistics', 'communication', 'analytics',
    'crm', 'trading', 'accounting', 'compliance', 'other'
  ]),
  vendor: z.string().optional(),
  isInternal: z.boolean().default(false),
  isPoc: z.boolean().default(false).describe('Is this the PoC tool being designed?'),
  description: z.string().optional(),
  usageByPersona: z.record(z.string(), ToolUsageSchema).optional(),
  integratesWith: z.array(z.string()).optional().describe('IDs of other tools this integrates with'),
  replacedBy: z.string().optional().describe('If deprecated, which tool replaced it'),
  tensions: z.array(z.string()).optional().describe('IDs of tensions related to this tool'),
});

const PocFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  benefitsByPersona: z.record(z.string(), z.object({
    benefitLevel: z.enum(['high', 'medium', 'low', 'none']),
    solvedPainPoints: z.array(z.string()),
    replacesTools: z.array(z.string()).optional(),
    evidence: z.array(z.string()).optional(),
  })).optional(),
  status: z.enum(['concept', 'designed', 'built', 'validated']).default('concept'),
});

const EntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['actor', 'object', 'concept', 'process', 'location', 'tool']),
  attributes: z.record(z.string(), z.string()).optional(),
  perspectives: z.record(z.string(), RolePerspectiveSchema).optional().describe('How each role views this entity (keyed by persona)'),
  relationships: z.array(z.object({
    targetId: z.string(),
    relation: z.string(),
    strength: z.number().min(0).max(1).optional(),
    roleSpecific: Persona.optional().describe('If this relationship only applies to a specific role'),
  })).optional(),
});

const TensionSchema = z.object({
  id: z.string(),
  description: z.string(),
  tensionType: z.enum(['intra-role', 'inter-role', 'system']).describe(
    'intra-role: contradiction within one role\'s worldview; inter-role: conflict between roles; system: product assumes wrong model'
  ),
  roles: z.array(z.string()).describe('Which roles are involved in this tension (persona IDs)'),
  entities: z.array(z.string()),
  status: z.enum(['open', 'resolved', 'monitoring']),
  evidence: z.array(z.string()).optional(),
  implications: z.string().optional().describe('What this tension means for the product'),
});

const OntologySchema = z.object({
  domain: z.string(),
  entities: z.array(EntitySchema),
  tools: z.array(ToolSchema).optional(),
  pocFeatures: z.array(PocFeatureSchema).optional(),
  tensions: z.array(TensionSchema).optional(),
  openQuestions: z.array(z.string()).optional(),
  terminology: z.record(z.string(), z.string()).optional(),
  lastUpdated: z.string(),
});

export const getOntologyTool = createTool({
  id: 'get-ontology',
  description: 'Retrieve the current domain ontology - all known entities, relationships, tensions, and open questions about grain pricing',
  inputSchema: z.object({
    section: z.enum(['all', 'entities', 'tensions', 'questions', 'terminology']).optional(),
  }),
  outputSchema: OntologySchema.partial(),
  execute: async ({ section = 'all' }) => {
    const ontology = await getFullOntology();
    if (section === 'all') return ontology;
    if (section === 'entities') return { domain: ontology.domain, entities: ontology.entities, lastUpdated: ontology.lastUpdated };
    if (section === 'tensions') return { domain: ontology.domain, tensions: ontology.tensions, lastUpdated: ontology.lastUpdated };
    if (section === 'questions') return { domain: ontology.domain, openQuestions: ontology.openQuestions, lastUpdated: ontology.lastUpdated };
    return { domain: ontology.domain, terminology: ontology.terminology, lastUpdated: ontology.lastUpdated };
  },
});

export const addEntityTool = createTool({
  id: 'add-entity',
  description: 'Add a new entity to the domain ontology with relationships',
  inputSchema: z.object({
    entity: EntitySchema,
  }),
  outputSchema: z.object({
    success: z.boolean(),
    entityCount: z.number(),
  }),
  execute: async ({ entity }) => {
    await upsertEntity(entity as EntityRow);
    const entities = await getAllEntities();
    return { success: true, entityCount: entities.length };
  },
});

export const addTensionTool = createTool({
  id: 'add-tension',
  description: 'Record a tension or contradiction discovered in user research',
  inputSchema: z.object({
    tension: TensionSchema,
  }),
  outputSchema: z.object({
    success: z.boolean(),
    tensionCount: z.number(),
  }),
  execute: async ({ tension }) => {
    await upsertTension(tension as TensionRow);
    const tensions = await getAllTensions();
    return { success: true, tensionCount: tensions.length };
  },
});

export const resolveQuestionTool = createTool({
  id: 'resolve-question',
  description: 'Mark an open question as resolved and optionally add findings to terminology',
  inputSchema: z.object({
    question: z.string(),
    resolution: z.string(),
    addToTerminology: z.boolean().optional(),
    termKey: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    remainingQuestions: z.number(),
  }),
  execute: async ({ question, resolution, addToTerminology, termKey }) => {
    await removeOpenQuestion(question);
    if (addToTerminology && termKey) {
      await upsertTerm(termKey, resolution);
    }
    const remaining = await getOpenQuestions();
    return { success: true, remainingQuestions: remaining.length };
  },
});

export const queryRelationshipsTool = createTool({
  id: 'query-relationships',
  description: 'Find all entities related to a given entity',
  inputSchema: z.object({
    entityId: z.string(),
    depth: z.number().min(1).max(3).optional(),
  }),
  outputSchema: z.object({
    entity: EntitySchema.optional(),
    related: z.array(z.object({
      entity: EntitySchema,
      relation: z.string(),
      direction: z.enum(['outgoing', 'incoming']),
    })),
  }),
  execute: async ({ entityId, depth = 1 }) => {
    const entities = await getAllEntities();
    const entity = entities.find(e => e.id === entityId);
    const related: Array<{ entity: EntityRow; relation: string; direction: 'outgoing' | 'incoming' }> = [];

    const visited = new Set<string>([entityId]);
    const queue: Array<{ id: string; currentDepth: number }> = [{ id: entityId, currentDepth: 0 }];

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;
      if (currentDepth >= depth) continue;

      const current = entities.find(e => e.id === id);
      if (current?.relationships) {
        for (const rel of current.relationships) {
          const target = entities.find(e => e.id === rel.targetId);
          if (target && !visited.has(target.id)) {
            visited.add(target.id);
            related.push({ entity: target, relation: rel.relation, direction: 'outgoing' });
            queue.push({ id: target.id, currentDepth: currentDepth + 1 });
          }
        }
      }

      for (const e of entities) {
        if (e.relationships && !visited.has(e.id)) {
          for (const rel of e.relationships) {
            if (rel.targetId === id) {
              visited.add(e.id);
              related.push({ entity: e, relation: rel.relation, direction: 'incoming' });
              queue.push({ id: e.id, currentDepth: currentDepth + 1 });
            }
          }
        }
      }
    }

    return { entity, related };
  },
});

export const addRolePerspectiveTool = createTool({
  id: 'add-role-perspective',
  description: 'Add or update how a specific role perceives an entity. Use this to capture role-specific mental models.',
  inputSchema: z.object({
    entityId: z.string(),
    role: Persona,
    perspective: RolePerspectiveSchema,
  }),
  outputSchema: z.object({
    success: z.boolean(),
    entity: EntitySchema,
    rolesWithPerspectives: z.array(z.string()),
  }),
  execute: async ({ entityId, role, perspective }) => {
    const entity = await updateEntityPerspective(entityId, role, perspective);
    const rolesWithPerspectives = Object.keys(entity.perspectives || {});
    return { success: true, entity, rolesWithPerspectives };
  },
});

export const queryByRoleTool = createTool({
  id: 'query-by-role',
  description: 'Get the ontology filtered to a specific role\'s perspective. Shows how that role views entities and their tensions.',
  inputSchema: z.object({
    role: Persona,
    includeShared: z.boolean().optional().describe('Include entities without role-specific perspectives'),
  }),
  outputSchema: z.object({
    role: Persona,
    roleLabel: z.string(),
    entities: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      perspective: RolePerspectiveSchema.optional(),
      hasRolePerspective: z.boolean(),
    })),
    tensions: z.array(TensionSchema),
    tensionCount: z.object({
      intraRole: z.number(),
      interRole: z.number(),
      system: z.number(),
    }),
  }),
  execute: async ({ role, includeShared = true }) => {
    const allEntities = await getAllEntities();
    const allTensions = await getAllTensions();

    const entities = allEntities
      .filter(e => includeShared || e.perspectives?.[role])
      .map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        perspective: e.perspectives?.[role] as z.infer<typeof RolePerspectiveSchema> | undefined,
        hasRolePerspective: !!e.perspectives?.[role],
      }));

    const tensions = allTensions.filter(t => t.roles.includes(role));

    const tensionCount = {
      intraRole: tensions.filter(t => t.tensionType === 'intra-role').length,
      interRole: tensions.filter(t => t.tensionType === 'inter-role').length,
      system: tensions.filter(t => t.tensionType === 'system').length,
    };

    return {
      role,
      roleLabel: PERSONA_LABELS[role],
      entities,
      tensions,
      tensionCount,
    };
  },
});

export const compareRolePerspectivesTool = createTool({
  id: 'compare-role-perspectives',
  description: 'Compare how two roles perceive the same entity. Useful for finding inter-role tensions.',
  inputSchema: z.object({
    entityId: z.string(),
    roleA: Persona,
    roleB: Persona,
  }),
  outputSchema: z.object({
    entity: z.string(),
    roleA: z.object({
      role: Persona,
      label: z.string(),
      perspective: RolePerspectiveSchema.optional(),
    }),
    roleB: z.object({
      role: Persona,
      label: z.string(),
      perspective: RolePerspectiveSchema.optional(),
    }),
    divergenceAreas: z.array(z.string()),
    existingTensions: z.array(TensionSchema),
  }),
  execute: async ({ entityId, roleA, roleB }) => {
    const entity = await getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);

    const perspA = entity.perspectives?.[roleA] as z.infer<typeof RolePerspectiveSchema> | undefined;
    const perspB = entity.perspectives?.[roleB] as z.infer<typeof RolePerspectiveSchema> | undefined;

    const divergenceAreas: string[] = [];
    if (perspA?.primaryConcern !== perspB?.primaryConcern) {
      divergenceAreas.push('primaryConcern');
    }
    if (JSON.stringify(perspA?.terminology) !== JSON.stringify(perspB?.terminology)) {
      divergenceAreas.push('terminology');
    }
    if (JSON.stringify(perspA?.painPoints) !== JSON.stringify(perspB?.painPoints)) {
      divergenceAreas.push('painPoints');
    }
    if (JSON.stringify(perspA?.workflows) !== JSON.stringify(perspB?.workflows)) {
      divergenceAreas.push('workflows');
    }

    const allTensions = await getAllTensions();
    const existingTensions = allTensions.filter(
      t => t.entities.includes(entityId) && t.roles.includes(roleA) && t.roles.includes(roleB)
    );

    return {
      entity: entity.name,
      roleA: { role: roleA, label: PERSONA_LABELS[roleA], perspective: perspA },
      roleB: { role: roleB, label: PERSONA_LABELS[roleB], perspective: perspB },
      divergenceAreas,
      existingTensions,
    };
  },
});

export const addToolTool = createTool({
  id: 'add-tool',
  description: 'Add a software tool to the tool ecosystem registry. Track which personas use it and how.',
  inputSchema: z.object({
    tool: ToolSchema,
  }),
  outputSchema: z.object({
    success: z.boolean(),
    toolCount: z.number(),
    pocToolCount: z.number(),
  }),
  execute: async ({ tool }) => {
    await upsertTool(tool as ToolRow);
    const tools = await getAllTools();
    const pocToolCount = tools.filter(t => t.isPoc).length;
    return { success: true, toolCount: tools.length, pocToolCount };
  },
});

export const addToolUsageTool = createTool({
  id: 'add-tool-usage',
  description: 'Record how a specific persona uses a tool. Captures frequency, sentiment, pain points, and workarounds.',
  inputSchema: z.object({
    toolId: z.string(),
    persona: Persona,
    usage: ToolUsageSchema,
  }),
  outputSchema: z.object({
    success: z.boolean(),
    tool: ToolSchema,
    personasTracked: z.array(z.string()),
  }),
  execute: async ({ toolId, persona, usage }) => {
    const tool = await getTool(toolId);
    if (!tool) throw new Error(`Tool ${toolId} not found. Add it first with add-tool.`);
    const usageByPersona = (tool.usageByPersona || {}) as Record<string, ToolUsage>;
    usageByPersona[persona] = usage;
    tool.usageByPersona = usageByPersona;
    await upsertTool(tool);
    return {
      success: true,
      tool,
      personasTracked: Object.keys(tool.usageByPersona),
    };
  },
});

export const getToolsByPersonaTool = createTool({
  id: 'get-tools-by-persona',
  description: 'Get all tools used by a specific persona, with their usage patterns and pain points.',
  inputSchema: z.object({
    persona: Persona,
    includeUnused: z.boolean().optional().describe('Include tools the persona does not use'),
  }),
  outputSchema: z.object({
    persona: z.string(),
    personaLabel: z.string(),
    tools: z.array(z.object({
      tool: ToolSchema,
      usage: ToolUsageSchema.optional(),
    })),
    painPointSummary: z.array(z.string()),
    mostUsedCategories: z.array(z.string()),
  }),
  execute: async ({ persona, includeUnused = false }) => {
    const allTools = await getAllTools();

    const toolsWithUsage = allTools
      .filter(t => includeUnused || t.usageByPersona?.[persona])
      .map(t => ({
        tool: t,
        usage: t.usageByPersona?.[persona] as z.infer<typeof ToolUsageSchema> | undefined,
      }));

    const allPainPoints = toolsWithUsage
      .flatMap(t => t.usage?.painPoints || []);

    const categoryCount: Record<string, number> = {};
    toolsWithUsage.forEach(t => {
      if (t.usage && t.usage.frequency !== 'never') {
        categoryCount[t.tool.category] = (categoryCount[t.tool.category] || 0) + 1;
      }
    });
    const mostUsedCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    return {
      persona,
      personaLabel: PERSONA_LABELS[persona],
      tools: toolsWithUsage,
      painPointSummary: [...new Set(allPainPoints)],
      mostUsedCategories,
    };
  },
});

export const addPocFeatureTool = createTool({
  id: 'add-poc-feature',
  description: 'Add or update a feature of the PoC tool being designed. Track benefits by persona.',
  inputSchema: z.object({
    feature: PocFeatureSchema,
  }),
  outputSchema: z.object({
    success: z.boolean(),
    featureCount: z.number(),
    personasCovered: z.array(z.string()),
  }),
  execute: async ({ feature }) => {
    await upsertPocFeature(feature as PocFeatureRow);
    const allFeatures = await getAllPocFeatures();

    const personasCovered = new Set<string>();
    allFeatures.forEach(f => {
      if (f.benefitsByPersona) {
        Object.entries(f.benefitsByPersona).forEach(([persona, benefit]) => {
          if ((benefit as { benefitLevel: string }).benefitLevel !== 'none') {
            personasCovered.add(persona);
          }
        });
      }
    });

    return {
      success: true,
      featureCount: allFeatures.length,
      personasCovered: Array.from(personasCovered),
    };
  },
});

export const getPocBenefitsByPersonaTool = createTool({
  id: 'get-poc-benefits-by-persona',
  description: 'See how the PoC tool benefits a specific persona. Shows solved pain points and replaced tools.',
  inputSchema: z.object({
    persona: Persona,
  }),
  outputSchema: z.object({
    persona: z.string(),
    personaLabel: z.string(),
    features: z.array(z.object({
      featureId: z.string(),
      featureName: z.string(),
      benefitLevel: z.string(),
      solvedPainPoints: z.array(z.string()),
      replacesTools: z.array(z.string()),
    })),
    totalPainPointsSolved: z.number(),
    toolsReplaced: z.array(z.string()),
    overallBenefitScore: z.enum(['high', 'medium', 'low', 'none']),
  }),
  execute: async ({ persona }) => {
    const allFeatures = await getAllPocFeatures();

    const features = allFeatures
      .filter(f => f.benefitsByPersona?.[persona])
      .map(f => {
        const benefit = f.benefitsByPersona![persona] as {
          benefitLevel: string;
          solvedPainPoints: string[];
          replacesTools?: string[];
        };
        return {
          featureId: f.id,
          featureName: f.name,
          benefitLevel: benefit.benefitLevel,
          solvedPainPoints: benefit.solvedPainPoints || [],
          replacesTools: benefit.replacesTools || [],
        };
      });

    const allSolvedPainPoints = new Set(features.flatMap(f => f.solvedPainPoints));
    const allReplacedTools = new Set(features.flatMap(f => f.replacesTools));

    const highCount = features.filter(f => f.benefitLevel === 'high').length;
    const mediumCount = features.filter(f => f.benefitLevel === 'medium').length;

    let overallBenefitScore: 'high' | 'medium' | 'low' | 'none' = 'none';
    if (highCount >= 2 || (highCount >= 1 && mediumCount >= 2)) {
      overallBenefitScore = 'high';
    } else if (highCount >= 1 || mediumCount >= 2) {
      overallBenefitScore = 'medium';
    } else if (features.length > 0) {
      overallBenefitScore = 'low';
    }

    return {
      persona,
      personaLabel: PERSONA_LABELS[persona],
      features,
      totalPainPointsSolved: allSolvedPainPoints.size,
      toolsReplaced: Array.from(allReplacedTools),
      overallBenefitScore,
    };
  },
});

export const compareToolEcosystemTool = createTool({
  id: 'compare-tool-ecosystem',
  description: 'Compare the tool ecosystem across personas. Find fragmentation, overlap, and consolidation opportunities.',
  inputSchema: z.object({
    personas: z.array(Persona).optional().describe('Personas to compare. Defaults to all.'),
  }),
  outputSchema: z.object({
    totalTools: z.number(),
    toolsByCategory: z.record(z.string(), z.number()),
    sharedTools: z.array(z.object({
      toolId: z.string(),
      toolName: z.string(),
      usedBy: z.array(z.string()),
    })),
    personaSpecificTools: z.record(z.string(), z.array(z.string())),
    fragmentationScore: z.number().describe('0-1 where 1 means high fragmentation'),
    consolidationOpportunities: z.array(z.string()),
  }),
  execute: async ({ personas }) => {
    const allTools = await getAllTools();
    const targetPersonas = personas || ['merchant', 'grain_origination_merchant', 'csr', 'strategic_account_rep'];

    const toolsByCategory: Record<string, number> = {};
    allTools.forEach(t => {
      toolsByCategory[t.category] = (toolsByCategory[t.category] || 0) + 1;
    });

    const sharedTools = allTools
      .filter(t => {
        const usedByCount = targetPersonas.filter(p => t.usageByPersona?.[p]).length;
        return usedByCount > 1;
      })
      .map(t => ({
        toolId: t.id,
        toolName: t.name,
        usedBy: targetPersonas.filter(p => t.usageByPersona?.[p]),
      }));

    const personaSpecificTools: Record<string, string[]> = {};
    targetPersonas.forEach(p => {
      const specific = allTools
        .filter(t => {
          const usedByThisPersona = t.usageByPersona?.[p];
          const usedByOthers = targetPersonas.filter(op => op !== p && t.usageByPersona?.[op]).length;
          return usedByThisPersona && usedByOthers === 0;
        })
        .map(t => t.name);
      if (specific.length > 0) {
        personaSpecificTools[PERSONA_LABELS[p as PersonaType]] = specific;
      }
    });

    const totalToolUsages = allTools.reduce((sum, t) => {
      return sum + targetPersonas.filter(p => t.usageByPersona?.[p]).length;
    }, 0);
    const maxPossibleSharing = allTools.length * targetPersonas.length;
    const fragmentationScore = maxPossibleSharing > 0
      ? 1 - (totalToolUsages / maxPossibleSharing)
      : 0;

    const consolidationOpportunities: string[] = [];
    const categoryTools: Record<string, ToolRow[]> = {};
    allTools.forEach(t => {
      categoryTools[t.category] = categoryTools[t.category] || [];
      categoryTools[t.category].push(t);
    });
    Object.entries(categoryTools).forEach(([category, tools]) => {
      if (tools.length > 2) {
        consolidationOpportunities.push(
          `${category}: ${tools.length} tools - consider consolidating ${tools.map(t => t.name).join(', ')}`
        );
      }
    });

    return {
      totalTools: allTools.length,
      toolsByCategory,
      sharedTools,
      personaSpecificTools,
      fragmentationScore: Math.round(fragmentationScore * 100) / 100,
      consolidationOpportunities,
    };
  },
});

export const getEvidenceChainTool = createTool({
  id: 'get-evidence-chain',
  description: 'Get the evidence chain for an entity or tension — all transcript sources, quotes, and analysis contexts that support it.',
  inputSchema: z.object({
    targetType: z.enum(['entity', 'tension', 'insight', 'term']),
    targetId: z.string().describe('The ID of the entity, tension, or term to look up evidence for'),
  }),
  outputSchema: z.object({
    targetType: z.string(),
    targetId: z.string(),
    evidenceCount: z.number(),
    sources: z.array(z.object({
      transcriptId: z.string(),
      quote: z.string().optional(),
      context: z.string().optional(),
      lensType: z.string().optional(),
      createdAt: z.string().optional(),
    })),
  }),
  execute: async ({ targetType, targetId }) => {
    const sources = await getEvidenceForTarget(targetType, targetId);
    return {
      targetType,
      targetId,
      evidenceCount: sources.length,
      sources: sources.map(s => ({
        transcriptId: s.transcriptId,
        quote: s.quote,
        context: s.context,
        lensType: s.lensType,
        createdAt: s.createdAt,
      })),
    };
  },
});

export const getTranscriptEvidenceTool = createTool({
  id: 'get-transcript-evidence',
  description: 'Get all entities and tensions that were derived from a specific transcript.',
  inputSchema: z.object({
    transcriptId: z.string().describe('The transcript ID to look up'),
  }),
  outputSchema: z.object({
    transcriptId: z.string(),
    totalReferences: z.number(),
    entities: z.array(z.object({
      targetId: z.string(),
      quote: z.string().optional(),
      context: z.string().optional(),
    })),
    tensions: z.array(z.object({
      targetId: z.string(),
      quote: z.string().optional(),
      context: z.string().optional(),
    })),
  }),
  execute: async ({ transcriptId }) => {
    const all = await getEvidenceByTranscript(transcriptId);
    const entities = all.filter(e => e.targetType === 'entity').map(e => ({
      targetId: e.targetId,
      quote: e.quote,
      context: e.context,
    }));
    const tensions = all.filter(e => e.targetType === 'tension').map(e => ({
      targetId: e.targetId,
      quote: e.quote,
      context: e.context,
    }));
    return {
      transcriptId,
      totalReferences: all.length,
      entities,
      tensions,
    };
  },
});


export const takeOntologySnapshotTool = createTool({
  id: 'take-ontology-snapshot',
  description: 'Take a snapshot of the current ontology state for versioning and undo purposes.',
  inputSchema: z.object({
    reason: z.string().optional().describe('Why this snapshot is being taken'),
  }),
  outputSchema: z.object({
    snapshotId: z.number(),
    reason: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ reason }) => {
    const id = await takeSnapshot(reason);
    return {
      snapshotId: id,
      reason,
      message: `Ontology snapshot #${id} saved.${reason ? ` Reason: ${reason}` : ''}`,
    };
  },
});

export const listOntologySnapshotsTool = createTool({
  id: 'list-ontology-snapshots',
  description: 'List all ontology snapshots ordered by most recent first.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    count: z.number(),
    snapshots: z.array(z.object({
      id: z.number(),
      reason: z.string().optional(),
      createdAt: z.string().optional(),
    })),
  }),
  execute: async () => {
    const snapshots = await listSnapshots();
    return {
      count: snapshots.length,
      snapshots,
    };
  },
});

export const getOntologySnapshotTool = createTool({
  id: 'get-ontology-snapshot',
  description: 'Retrieve a specific ontology snapshot by ID to inspect what the ontology looked like at that point.',
  inputSchema: z.object({
    snapshotId: z.number().describe('The ID of the snapshot to retrieve'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    snapshotId: z.number(),
    reason: z.string().optional(),
    createdAt: z.string().optional(),
    ontology: z.unknown().optional(),
  }),
  execute: async ({ snapshotId }) => {
    const snap = await getSnapshot(snapshotId);
    if (!snap) {
      return { found: false, snapshotId };
    }
    return {
      found: true,
      snapshotId,
      reason: snap.reason,
      createdAt: snap.createdAt,
      ontology: JSON.parse(snap.snapshot),
    };
  },
});
