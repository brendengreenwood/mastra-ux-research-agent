import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const OOUXObject = z.object({
  name: z.string(),
  type: z.enum(['core', 'supporting', 'peripheral']),
  attributes: z.array(z.string()),
  actions: z.array(z.string()),
  relationships: z.array(z.object({
    target: z.string(),
    nature: z.string(),
    cardinality: z.enum(['one-to-one', 'one-to-many', 'many-to-many']).optional(),
  })),
  evidence: z.array(z.string()).optional(),
});

const JTBDJob = z.object({
  jobStatement: z.string(),
  context: z.string(),
  motivation: z.string(),
  desiredOutcome: z.string(),
  currentSolution: z.string().optional(),
  painPoints: z.array(z.string()),
  successMetrics: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
});

const TaskStep = z.object({
  id: z.string(),
  action: z.string(),
  actor: z.string(),
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  decisions: z.array(z.string()).optional(),
  painPoints: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
});

const TaskFlow = z.object({
  name: z.string(),
  goal: z.string(),
  trigger: z.string(),
  steps: z.array(TaskStep),
  branches: z.array(z.object({
    condition: z.string(),
    fromStep: z.string(),
    toStep: z.string(),
  })).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ad-hoc']).optional(),
  evidence: z.array(z.string()).optional(),
});

const MentalModelConcept = z.object({
  concept: z.string(),
  userUnderstanding: z.string(),
  accuracy: z.enum(['accurate', 'partial', 'misconception']),
  implications: z.array(z.string()),
  relatedConcepts: z.array(z.string()),
  evidence: z.array(z.string()).optional(),
});

const ToolMediationSchema = z.object({
  toolId: z.string().describe('ID of the tool from the tool registry'),
  toolName: z.string(),
  role: z.enum(['primary', 'secondary', 'fallback']).describe('How central this tool is to the operation'),
  friction: z.enum(['none', 'low', 'medium', 'high']).optional(),
  workaround: z.string().optional().describe('If friction exists, what workaround is used'),
});

const Operation = z.object({
  id: z.string(),
  action: z.string().describe('Smallest unit of action, often automated or unconscious'),
  tools: z.array(z.string()).optional().describe('Simple tool names for quick capture'),
  toolMediation: z.array(ToolMediationSchema).optional().describe('Detailed tool usage for this operation'),
  conditions: z.string().optional().describe('Conditions under which this operation is performed'),
  automaticity: z.enum(['conscious', 'semi-automatic', 'automatic']).describe('How automatic this operation has become'),
  inputFrom: z.string().optional().describe('Which tool/system provides input'),
  outputTo: z.string().optional().describe('Which tool/system receives output'),
});

const Task = z.object({
  id: z.string(),
  goal: z.string().describe('Conscious goal driving this task'),
  operations: z.array(Operation),
  conditions: z.string().optional().describe('Conditions that shape how the task is performed'),
  variations: z.array(z.string()).optional().describe('Different ways this task might be performed'),
  breakdowns: z.array(z.string()).optional().describe('Where the task breaks down or fails'),
  toolSwitches: z.array(z.object({
    from: z.string(),
    to: z.string(),
    reason: z.string().optional(),
    friction: z.enum(['none', 'low', 'medium', 'high']).optional(),
  })).optional().describe('Context switches between tools within this task'),
});

const Activity = z.object({
  id: z.string(),
  name: z.string(),
  motive: z.string().describe('High-level motive or object driving the activity'),
  subject: z.string().describe('Who performs this activity (role/persona)'),
  tasks: z.array(Task),
  community: z.array(z.string()).optional().describe('Others involved in or affected by this activity'),
  rules: z.array(z.string()).optional().describe('Norms, conventions, or constraints governing the activity'),
  division: z.string().optional().describe('How work is divided among participants'),
  contradictions: z.array(z.object({
    type: z.enum(['primary', 'secondary', 'tertiary', 'quaternary']),
    description: z.string(),
    between: z.array(z.string()),
  })).optional().describe('Contradictions or tensions within the activity system'),
  evidence: z.array(z.string()).optional(),
});

export const applyOOUXLensTool = createTool({
  id: 'apply-ooux-lens',
  description: 'Apply Object-Oriented UX lens to extract objects, their attributes, actions, and relationships from research data. Best for entity extraction and information architecture.',
  inputSchema: z.object({
    transcriptId: z.string(),
    extractedObjects: z.array(OOUXObject),
    analysisNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    lens: z.literal('OOUX'),
    transcriptId: z.string(),
    objectCount: z.number(),
    coreObjects: z.array(z.string()),
    relationshipCount: z.number(),
    suggestedOntologyUpdates: z.array(z.object({
      type: z.enum(['add_entity', 'add_relationship', 'update_entity']),
      details: z.string(),
    })),
    analysisNotes: z.string().optional(),
  }),
  execute: async ({ transcriptId, extractedObjects, analysisNotes }) => {
    const coreObjects = extractedObjects.filter(o => o.type === 'core').map(o => o.name);
    const relationshipCount = extractedObjects.reduce((sum, o) => sum + o.relationships.length, 0);

    const suggestedOntologyUpdates = extractedObjects.map(obj => ({
      type: 'add_entity' as const,
      details: `Add "${obj.name}" as ${obj.type} object with attributes: ${obj.attributes.join(', ')}`,
    }));

    return {
      lens: 'OOUX' as const,
      transcriptId,
      objectCount: extractedObjects.length,
      coreObjects,
      relationshipCount,
      suggestedOntologyUpdates,
      analysisNotes,
    };
  },
});

export const applyJTBDLensTool = createTool({
  id: 'apply-jtbd-lens',
  description: 'Apply Jobs to be Done lens to extract user motivations, desired outcomes, and pain points. Best for understanding why users do what they do.',
  inputSchema: z.object({
    transcriptId: z.string(),
    extractedJobs: z.array(JTBDJob),
    analysisNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    lens: z.literal('JTBD'),
    transcriptId: z.string(),
    jobCount: z.number(),
    primaryJobs: z.array(z.string()),
    topPainPoints: z.array(z.string()),
    unmetNeeds: z.array(z.string()),
    opportunityAreas: z.array(z.string()),
    analysisNotes: z.string().optional(),
  }),
  execute: async ({ transcriptId, extractedJobs, analysisNotes }) => {
    const primaryJobs = extractedJobs.map(j => j.jobStatement);
    const allPainPoints = extractedJobs.flatMap(j => j.painPoints);
    const uniquePainPoints = [...new Set(allPainPoints)];

    const unmetNeeds = extractedJobs
      .filter(j => !j.currentSolution || j.painPoints.length > 2)
      .map(j => j.desiredOutcome);

    const opportunityAreas = extractedJobs
      .filter(j => j.painPoints.length > 0)
      .map(j => `Improve "${j.jobStatement}" by addressing: ${j.painPoints[0]}`);

    return {
      lens: 'JTBD' as const,
      transcriptId,
      jobCount: extractedJobs.length,
      primaryJobs,
      topPainPoints: uniquePainPoints.slice(0, 5),
      unmetNeeds,
      opportunityAreas,
      analysisNotes,
    };
  },
});

export const applyTaskAnalysisLensTool = createTool({
  id: 'apply-task-analysis-lens',
  description: 'Apply Task Analysis lens to extract sequential workflows, decision points, and task breakdowns. Best for understanding how users accomplish goals.',
  inputSchema: z.object({
    transcriptId: z.string(),
    extractedFlows: z.array(TaskFlow),
    analysisNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    lens: z.literal('TaskAnalysis'),
    transcriptId: z.string(),
    flowCount: z.number(),
    totalSteps: z.number(),
    decisionPoints: z.array(z.string()),
    bottlenecks: z.array(z.object({
      step: z.string(),
      issue: z.string(),
    })),
    automationOpportunities: z.array(z.string()),
    analysisNotes: z.string().optional(),
  }),
  execute: async ({ transcriptId, extractedFlows, analysisNotes }) => {
    const totalSteps = extractedFlows.reduce((sum, f) => sum + f.steps.length, 0);

    const decisionPoints = extractedFlows.flatMap(f =>
      f.steps.filter(s => s.decisions && s.decisions.length > 0)
        .map(s => `${f.name}: ${s.action}`)
    );

    const bottlenecks = extractedFlows.flatMap(f =>
      f.steps.filter(s => s.painPoints && s.painPoints.length > 0)
        .map(s => ({ step: `${f.name} → ${s.action}`, issue: s.painPoints![0] }))
    );

    const automationOpportunities = extractedFlows.flatMap(f =>
      f.steps.filter(s => !s.decisions || s.decisions.length === 0)
        .filter(s => s.action.toLowerCase().includes('check') ||
                    s.action.toLowerCase().includes('calculate') ||
                    s.action.toLowerCase().includes('lookup'))
        .map(s => `${f.name}: "${s.action}" could be automated`)
    );

    return {
      lens: 'TaskAnalysis' as const,
      transcriptId,
      flowCount: extractedFlows.length,
      totalSteps,
      decisionPoints,
      bottlenecks,
      automationOpportunities,
      analysisNotes,
    };
  },
});

export const applyMentalModelLensTool = createTool({
  id: 'apply-mental-model-lens',
  description: 'Apply Mental Model Mapping lens to understand how users conceptualize the domain, identify misconceptions, and map their understanding. Best for finding gaps between user and system models.',
  inputSchema: z.object({
    transcriptId: z.string(),
    extractedConcepts: z.array(MentalModelConcept),
    analysisNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    lens: z.literal('MentalModel'),
    transcriptId: z.string(),
    conceptCount: z.number(),
    accurateUnderstandings: z.array(z.string()),
    partialUnderstandings: z.array(z.string()),
    misconceptions: z.array(z.object({
      concept: z.string(),
      userBelief: z.string(),
      implications: z.array(z.string()),
    })),
    educationOpportunities: z.array(z.string()),
    analysisNotes: z.string().optional(),
  }),
  execute: async ({ transcriptId, extractedConcepts, analysisNotes }) => {
    const accurateUnderstandings = extractedConcepts
      .filter(c => c.accuracy === 'accurate')
      .map(c => c.concept);

    const partialUnderstandings = extractedConcepts
      .filter(c => c.accuracy === 'partial')
      .map(c => c.concept);

    const misconceptions = extractedConcepts
      .filter(c => c.accuracy === 'misconception')
      .map(c => ({
        concept: c.concept,
        userBelief: c.userUnderstanding,
        implications: c.implications,
      }));

    const educationOpportunities = extractedConcepts
      .filter(c => c.accuracy !== 'accurate')
      .map(c => `Clarify "${c.concept}": User understands it as "${c.userUnderstanding}"`);

    return {
      lens: 'MentalModel' as const,
      transcriptId,
      conceptCount: extractedConcepts.length,
      accurateUnderstandings,
      partialUnderstandings,
      misconceptions,
      educationOpportunities,
      analysisNotes,
    };
  },
});

export const applyActivityLensTool = createTool({
  id: 'apply-activity-lens',
  description: `Apply Activity Theory lens to extract hierarchical goal structures. Best for understanding WHY users do things at multiple levels of abstraction.

  Hierarchy:
  - Activity (high-level goal driven by motive)
    └── Task (specific step driven by conscious goal)
          └── Operation (smallest action, often automatic)

  Also captures contradictions within activity systems.`,
  inputSchema: z.object({
    transcriptId: z.string(),
    persona: z.string().describe('The role/persona performing these activities'),
    extractedActivities: z.array(Activity),
    analysisNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    lens: z.literal('Activity'),
    transcriptId: z.string(),
    activityCount: z.number(),
    taskCount: z.number(),
    operationCount: z.number(),
    activities: z.array(z.object({
      name: z.string(),
      motive: z.string(),
      taskCount: z.number(),
    })),
    breakdowns: z.array(z.object({
      activity: z.string(),
      task: z.string(),
      issue: z.string(),
    })),
    contradictions: z.array(z.object({
      activity: z.string(),
      type: z.string(),
      description: z.string(),
    })),
    automationCandidates: z.array(z.object({
      activity: z.string(),
      task: z.string(),
      operation: z.string(),
      reason: z.string(),
    })),
    toolEcosystem: z.object({
      uniqueTools: z.array(z.string()),
      toolsByFrequency: z.array(z.object({ tool: z.string(), count: z.number() })),
      toolSwitches: z.array(z.object({
        from: z.string(),
        to: z.string(),
        occurrences: z.number(),
        friction: z.string().optional(),
      })),
      highFrictionTools: z.array(z.string()),
      consolidationOpportunities: z.array(z.string()),
    }),
    designImplications: z.array(z.string()),
    analysisNotes: z.string().optional(),
  }),
  execute: async ({ transcriptId, persona, extractedActivities, analysisNotes }) => {
    const taskCount = extractedActivities.reduce((sum, a) => sum + a.tasks.length, 0);
    const operationCount = extractedActivities.reduce(
      (sum, a) => sum + a.tasks.reduce((tSum, t) => tSum + t.operations.length, 0),
      0
    );

    const activities = extractedActivities.map(a => ({
      name: a.name,
      motive: a.motive,
      taskCount: a.tasks.length,
    }));

    const breakdowns = extractedActivities.flatMap(a =>
      a.tasks.flatMap(t =>
        (t.breakdowns || []).map(b => ({
          activity: a.name,
          task: t.goal,
          issue: b,
        }))
      )
    );

    const contradictions = extractedActivities.flatMap(a =>
      (a.contradictions || []).map(c => ({
        activity: a.name,
        type: c.type,
        description: c.description,
      }))
    );

    const automationCandidates = extractedActivities.flatMap(a =>
      a.tasks.flatMap(t =>
        t.operations
          .filter(o => o.automaticity === 'automatic' || o.automaticity === 'semi-automatic')
          .map(o => ({
            activity: a.name,
            task: t.goal,
            operation: o.action,
            reason: o.automaticity === 'automatic'
              ? 'Already automatic for user - system should handle'
              : 'Semi-automatic - good candidate for assistance',
          }))
      )
    );

    const designImplications: string[] = [];

    if (breakdowns.length > 0) {
      designImplications.push(
        `${breakdowns.length} task breakdowns identified - prioritize fixing these friction points`
      );
    }

    if (contradictions.length > 0) {
      designImplications.push(
        `${contradictions.length} contradictions in activity systems - these are root causes of user frustration`
      );
    }

    if (automationCandidates.length > 0) {
      designImplications.push(
        `${automationCandidates.length} operations could be automated - users already do these unconsciously`
      );
    }

    const rulesCount = extractedActivities.reduce((sum, a) => sum + (a.rules?.length || 0), 0);
    if (rulesCount > 0) {
      designImplications.push(
        `${rulesCount} rules/conventions govern these activities - system must respect or explicitly change them`
      );
    }

    const allTools: string[] = [];
    const toolFrequency: Record<string, number> = {};
    const toolSwitchMap: Record<string, { from: string; to: string; friction?: string; count: number }> = {};
    const highFrictionTools: string[] = [];

    extractedActivities.forEach(a => {
      a.tasks.forEach(t => {
        t.operations.forEach(o => {
          const opTools = o.toolMediation?.map(tm => tm.toolName) || o.tools || [];
          opTools.forEach(tool => {
            allTools.push(tool);
            toolFrequency[tool] = (toolFrequency[tool] || 0) + 1;
          });

          o.toolMediation?.forEach(tm => {
            if (tm.friction === 'high' || tm.friction === 'medium') {
              if (!highFrictionTools.includes(tm.toolName)) {
                highFrictionTools.push(tm.toolName);
              }
            }
          });
        });

        t.toolSwitches?.forEach(sw => {
          const key = `${sw.from}→${sw.to}`;
          if (!toolSwitchMap[key]) {
            toolSwitchMap[key] = { from: sw.from, to: sw.to, friction: sw.friction, count: 0 };
          }
          toolSwitchMap[key].count++;
        });
      });
    });

    const uniqueTools = [...new Set(allTools)];
    const toolsByFrequency = Object.entries(toolFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([tool, count]) => ({ tool, count }));
    const toolSwitches = Object.values(toolSwitchMap)
      .sort((a, b) => b.count - a.count)
      .map(s => ({ from: s.from, to: s.to, occurrences: s.count, friction: s.friction }));

    const consolidationOpportunities: string[] = [];
    if (toolSwitches.length > 3) {
      designImplications.push(
        `${toolSwitches.length} tool switches detected - high context-switching cost`
      );
      const frequentSwitches = toolSwitches.filter(s => s.occurrences > 1);
      frequentSwitches.forEach(s => {
        consolidationOpportunities.push(
          `Consider integrating ${s.from} → ${s.to} (${s.occurrences} switches${s.friction ? `, ${s.friction} friction` : ''})`
        );
      });
    }

    if (highFrictionTools.length > 0) {
      designImplications.push(
        `${highFrictionTools.length} high-friction tools: ${highFrictionTools.join(', ')} - prioritize replacing or improving`
      );
    }

    const toolEcosystem = {
      uniqueTools,
      toolsByFrequency,
      toolSwitches,
      highFrictionTools,
      consolidationOpportunities,
    };

    return {
      lens: 'Activity' as const,
      transcriptId,
      activityCount: extractedActivities.length,
      taskCount,
      operationCount,
      activities,
      breakdowns,
      contradictions,
      automationCandidates,
      toolEcosystem,
      designImplications,
      analysisNotes,
    };
  },
});

const LensType = z.enum(['OOUX', 'JTBD', 'TaskAnalysis', 'MentalModel', 'Activity']);

export const getLensRecommendationTool = createTool({
  id: 'get-lens-recommendation',
  description: `Get recommended analytical lens based on research classification and goals.

  Available lenses:
  - OOUX: Extract objects, attributes, relationships (entity discovery)
  - JTBD: Extract jobs, motivations, pain points (understand WHY)
  - TaskAnalysis: Extract sequences, decisions, flows (understand HOW)
  - MentalModel: Map user understanding, find misconceptions (gap analysis)
  - Activity: Hierarchical goal structures with Activity → Task → Operation (deep WHY + HOW)`,
  inputSchema: z.object({
    dataType: z.enum(['attitudinal', 'behavioral']),
    methodology: z.enum(['qualitative', 'quantitative', 'mixed']),
    phase: z.enum(['discovery', 'definition', 'validation', 'iteration']),
    researchGoal: z.string().optional(),
  }),
  outputSchema: z.object({
    primaryLens: LensType,
    secondaryLens: LensType.optional(),
    reasoning: z.string(),
  }),
  execute: async ({ dataType, methodology, phase, researchGoal }) => {
    type Lens = z.infer<typeof LensType>;
    let primaryLens: Lens;
    let secondaryLens: Lens | undefined;
    let reasoning: string;

    if (phase === 'discovery') {
      primaryLens = 'OOUX';
      secondaryLens = 'MentalModel';
      reasoning = 'Discovery phase: Extract entities and understand user mental models first.';
    } else if (phase === 'definition') {
      primaryLens = 'Activity';
      secondaryLens = 'JTBD';
      reasoning = 'Definition phase: Map full activity hierarchy and underlying motivations.';
    } else if (dataType === 'behavioral') {
      primaryLens = 'Activity';
      secondaryLens = 'TaskAnalysis';
      reasoning = 'Behavioral data: Use Activity lens for hierarchical goal structure, TaskAnalysis for detailed flows.';
    } else if (dataType === 'attitudinal') {
      primaryLens = 'JTBD';
      secondaryLens = 'MentalModel';
      reasoning = 'Attitudinal data: Extract jobs and validate mental models.';
    } else {
      primaryLens = 'OOUX';
      reasoning = 'Default to OOUX for entity extraction.';
    }

    return { primaryLens, secondaryLens, reasoning };
  },
});
