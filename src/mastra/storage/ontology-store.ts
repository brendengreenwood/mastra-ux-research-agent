import { getDb } from './db.js';

// ---- Types ----

export type PersonaType = 'merchant' | 'grain_origination_merchant' | 'csr' | 'strategic_account_rep';
export type EntityType = 'actor' | 'object' | 'concept' | 'process' | 'location' | 'tool';

export interface RolePerspective {
  primaryConcern: string;
  mentalModel?: string;
  terminology?: string[];
  painPoints?: string[];
  workflows?: string[];
  evidence?: string[];
}

export interface EntityRow {
  id: string;
  name: string;
  type: EntityType;
  attributes?: Record<string, string>;
  perspectives?: Record<string, RolePerspective>;
  relationships?: Array<{ targetId: string; relation: string; strength?: number; roleSpecific?: PersonaType }>;
}

export async function getAllEntities(): Promise<EntityRow[]> {
  const db = getDb();
  const rs = await db.execute('SELECT * FROM entities');
  return rs.rows.map(rowToEntity);
}

export async function getEntity(id: string): Promise<EntityRow | null> {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM entities WHERE id = ?', args: [id] });
  return rs.rows.length > 0 ? rowToEntity(rs.rows[0]) : null;
}

export async function upsertEntity(entity: EntityRow): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO entities (id, name, type, attributes, perspectives, relationships, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            type = excluded.type,
            attributes = excluded.attributes,
            perspectives = excluded.perspectives,
            relationships = excluded.relationships,
            updated_at = datetime('now')`,
    args: [
      entity.id,
      entity.name,
      entity.type,
      entity.attributes ? JSON.stringify(entity.attributes) : null,
      entity.perspectives ? JSON.stringify(entity.perspectives) : null,
      entity.relationships ? JSON.stringify(entity.relationships) : null,
    ],
  });
  await touchLastUpdated();
}

export async function updateEntityPerspective(
  entityId: string,
  role: string,
  perspective: RolePerspective,
): Promise<EntityRow> {
  const entity = await getEntity(entityId);
  if (!entity) throw new Error(`Entity ${entityId} not found`);
  const perspectives = entity.perspectives || {};
  perspectives[role] = perspective;
  entity.perspectives = perspectives;
  await upsertEntity(entity);
  return entity;
}

function rowToEntity(row: Record<string, unknown>): EntityRow {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as EntityType,
    attributes: row.attributes ? JSON.parse(row.attributes as string) : undefined,
    perspectives: row.perspectives ? JSON.parse(row.perspectives as string) : undefined,
    relationships: row.relationships ? JSON.parse(row.relationships as string) : undefined,
  };
}

// ---- Tension CRUD ----

export type TensionType = 'intra-role' | 'inter-role' | 'system';
export type TensionStatus = 'open' | 'resolved' | 'monitoring';

export interface TensionRow {
  id: string;
  description: string;
  tensionType: TensionType;
  roles: string[];
  entities: string[];
  status: TensionStatus;
  evidence?: string[];
  implications?: string;
}

export async function getAllTensions(): Promise<TensionRow[]> {
  const db = getDb();
  const rs = await db.execute('SELECT * FROM tensions');
  return rs.rows.map(rowToTension);
}

export async function upsertTension(tension: TensionRow): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO tensions (id, description, tension_type, roles, entities, status, evidence, implications, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            description = excluded.description,
            tension_type = excluded.tension_type,
            roles = excluded.roles,
            entities = excluded.entities,
            status = excluded.status,
            evidence = excluded.evidence,
            implications = excluded.implications,
            updated_at = datetime('now')`,
    args: [
      tension.id,
      tension.description,
      tension.tensionType,
      JSON.stringify(tension.roles),
      JSON.stringify(tension.entities),
      tension.status,
      tension.evidence ? JSON.stringify(tension.evidence) : null,
      tension.implications || null,
    ],
  });
  await touchLastUpdated();
}

function rowToTension(row: Record<string, unknown>): TensionRow {
  return {
    id: row.id as string,
    description: row.description as string,
    tensionType: row.tension_type as TensionRow['tensionType'],
    roles: JSON.parse(row.roles as string),
    entities: JSON.parse(row.entities as string),
    status: row.status as TensionRow['status'],
    evidence: row.evidence ? JSON.parse(row.evidence as string) : undefined,
    implications: (row.implications as string) || undefined,
  };
}

// ---- Open Questions ----

export async function getOpenQuestions(): Promise<string[]> {
  const db = getDb();
  const rs = await db.execute('SELECT question FROM open_questions ORDER BY id');
  return rs.rows.map(r => r.question as string);
}

export async function addOpenQuestion(question: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'INSERT OR IGNORE INTO open_questions (question) VALUES (?)',
    args: [question],
  });
}

export async function removeOpenQuestion(question: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM open_questions WHERE question = ?',
    args: [question],
  });
}

// ---- Terminology ----

export async function getTerminology(): Promise<Record<string, string>> {
  const db = getDb();
  const rs = await db.execute('SELECT term, definition FROM terminology');
  const result: Record<string, string> = {};
  for (const row of rs.rows) {
    result[row.term as string] = row.definition as string;
  }
  return result;
}

export async function upsertTerm(term: string, definition: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO terminology (term, definition, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(term) DO UPDATE SET definition = excluded.definition, updated_at = datetime('now')`,
    args: [term, definition],
  });
}

// ---- Tool CRUD ----

export type ToolCategory = 'pricing' | 'contracts' | 'logistics' | 'communication' | 'analytics' | 'crm' | 'trading' | 'accounting' | 'compliance' | 'other';

export interface ToolUsage {
  frequency: 'daily' | 'weekly' | 'monthly' | 'rarely' | 'never';
  proficiency?: 'expert' | 'proficient' | 'basic' | 'struggling';
  sentiment?: 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
  painPoints?: string[];
  workarounds?: string[];
  wishlist?: string[];
  evidence?: string[];
}

export interface ToolRow {
  id: string;
  name: string;
  category: ToolCategory;
  vendor?: string;
  isInternal: boolean;
  isPoc: boolean;
  description?: string;
  usageByPersona?: Record<string, ToolUsage>;
  integratesWith?: string[];
  replacedBy?: string;
  tensions?: string[];
}

export async function getAllTools(): Promise<ToolRow[]> {
  const db = getDb();
  const rs = await db.execute('SELECT * FROM tools');
  return rs.rows.map(rowToTool);
}

export async function getTool(id: string): Promise<ToolRow | null> {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM tools WHERE id = ?', args: [id] });
  return rs.rows.length > 0 ? rowToTool(rs.rows[0]) : null;
}

export async function upsertTool(tool: ToolRow): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO tools (id, name, category, vendor, is_internal, is_poc, description, usage_by_persona, integrates_with, replaced_by, tool_tensions, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            vendor = excluded.vendor,
            is_internal = excluded.is_internal,
            is_poc = excluded.is_poc,
            description = excluded.description,
            usage_by_persona = excluded.usage_by_persona,
            integrates_with = excluded.integrates_with,
            replaced_by = excluded.replaced_by,
            tool_tensions = excluded.tool_tensions,
            updated_at = datetime('now')`,
    args: [
      tool.id,
      tool.name,
      tool.category,
      tool.vendor || null,
      tool.isInternal ? 1 : 0,
      tool.isPoc ? 1 : 0,
      tool.description || null,
      tool.usageByPersona ? JSON.stringify(tool.usageByPersona) : null,
      tool.integratesWith ? JSON.stringify(tool.integratesWith) : null,
      tool.replacedBy || null,
      tool.tensions ? JSON.stringify(tool.tensions) : null,
    ],
  });
  await touchLastUpdated();
}

function rowToTool(row: Record<string, unknown>): ToolRow {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as ToolCategory,
    vendor: (row.vendor as string) || undefined,
    isInternal: row.is_internal === 1,
    isPoc: row.is_poc === 1,
    description: (row.description as string) || undefined,
    usageByPersona: row.usage_by_persona ? JSON.parse(row.usage_by_persona as string) : undefined,
    integratesWith: row.integrates_with ? JSON.parse(row.integrates_with as string) : undefined,
    replacedBy: (row.replaced_by as string) || undefined,
    tensions: row.tool_tensions ? JSON.parse(row.tool_tensions as string) : undefined,
  };
}

// ---- PoC Features ----

export interface PocBenefit {
  benefitLevel: 'high' | 'medium' | 'low' | 'none';
  solvedPainPoints: string[];
  replacesTools?: string[];
  evidence?: string[];
}

export interface PocFeatureRow {
  id: string;
  name: string;
  description: string;
  benefitsByPersona?: Record<string, PocBenefit>;
  status: 'concept' | 'designed' | 'built' | 'validated';
}

export async function getAllPocFeatures(): Promise<PocFeatureRow[]> {
  const db = getDb();
  const rs = await db.execute('SELECT * FROM poc_features');
  return rs.rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    benefitsByPersona: r.benefits_by_persona ? JSON.parse(r.benefits_by_persona as string) : undefined,
    status: r.status as PocFeatureRow['status'],
  }));
}

export async function upsertPocFeature(feature: PocFeatureRow): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO poc_features (id, name, description, benefits_by_persona, status, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            benefits_by_persona = excluded.benefits_by_persona,
            status = excluded.status,
            updated_at = datetime('now')`,
    args: [
      feature.id,
      feature.name,
      feature.description,
      feature.benefitsByPersona ? JSON.stringify(feature.benefitsByPersona) : null,
      feature.status,
    ],
  });
  await touchLastUpdated();
}

// ---- Ontology Meta ----

export async function getDomain(): Promise<string> {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT value FROM ontology_meta WHERE key = ?', args: ['domain'] });
  return rs.rows.length > 0 ? rs.rows[0].value as string : 'grain-origination';
}

export async function getLastUpdated(): Promise<string> {
  const db = getDb();
  const rs = await db.execute({ sql: 'SELECT value FROM ontology_meta WHERE key = ?', args: ['last_updated'] });
  return rs.rows.length > 0 ? rs.rows[0].value as string : new Date().toISOString();
}

async function touchLastUpdated(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO ontology_meta (key, value) VALUES ('last_updated', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [now],
  });
}

// ---- Full Ontology Read (for getOntologyTool) ----

export async function getFullOntology() {
  const [domain, entities, tensions, openQuestions, terminology, tools, pocFeatures, lastUpdated] = await Promise.all([
    getDomain(),
    getAllEntities(),
    getAllTensions(),
    getOpenQuestions(),
    getTerminology(),
    getAllTools(),
    getAllPocFeatures(),
    getLastUpdated(),
  ]);

  return {
    domain,
    entities,
    tools,
    pocFeatures,
    tensions,
    openQuestions,
    terminology,
    lastUpdated,
  };
}

// ---- Seed Data ----

export async function seedIfEmpty(): Promise<void> {
  const db = getDb();
  const entityCount = await db.execute('SELECT COUNT(*) as cnt FROM entities');
  if ((entityCount.rows[0].cnt as number) > 0) return;

  const seedEntities: EntityRow[] = [
    { id: 'producer', name: 'Producer', type: 'actor', attributes: { role: 'sells grain' } },
    { id: 'elevator', name: 'Elevator', type: 'actor', attributes: { role: 'buys/stores grain' } },
    {
      id: 'contract', name: 'Contract', type: 'object',
      attributes: { purpose: 'pricing agreement' },
      perspectives: {
        merchant: { primaryConcern: 'position exposure and hedge timing' },
        grain_origination_merchant: { primaryConcern: 'volume secured and relationship health' },
        csr: { primaryConcern: 'producer satisfaction and issue resolution' },
        strategic_account_rep: { primaryConcern: 'account health and long-term value' },
      },
    },
    { id: 'basis', name: 'Basis', type: 'concept', attributes: { definition: 'local price adjustment' } },
    { id: 'futures', name: 'Futures Price', type: 'concept', attributes: { definition: 'commodity exchange price' } },
  ];

  for (const entity of seedEntities) {
    await upsertEntity(entity);
  }

  const seedQuestions = [
    'How do different roles prioritize contract information?',
    'Where do mental models diverge between Merchant and CSR?',
    'What terminology differences cause miscommunication?',
    'Which existing tools create the most friction for each persona?',
    'What tool workflows could be consolidated?',
  ];
  for (const q of seedQuestions) {
    await addOpenQuestion(q);
  }

  const seedTerms: Record<string, string> = {
    'basis': 'The difference between local cash price and futures price',
    'hedge': 'Offsetting price risk through futures contracts',
    'cash sale': 'Immediate delivery and payment',
    'forward contract': 'Agreement to deliver at future date for set price',
  };
  for (const [term, def] of Object.entries(seedTerms)) {
    await upsertTerm(term, def);
  }
}
