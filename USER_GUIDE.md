# Cognitive Research Agent - User Guide

A research agent for analyzing UX research data across multiple personas in the grain origination domain.

## Quick Start

```bash
# Start Mastra Studio
npx mastra dev

# Open in browser
http://localhost:4111
```

## Personas

The system tracks four personas:

| ID | Label | Focus |
|----|-------|-------|
| `merchant` | Merchant | Market position, risk, hedging, margins |
| `grain_origination_merchant` | Grain Origination Merchant | Producer relationships, sourcing, contracts |
| `csr` | Customer Service Rep | Producer issues, contract servicing |
| `strategic_account_rep` | Strategic Account Rep | Key accounts, long-term relationships |

## Core Workflows

### 1. Ingest a Transcript

Use the **cognitive-research-workflow** in Studio:

```json
{
  "content": "paste transcript here...",
  "source": "Interview - March 2024",
  "persona": "grain_origination_merchant",
  "participantId": "GOM-001",
  "context": "Discovery interview about contract workflows"
}
```

The workflow will:
1. Ingest and classify the transcript
2. Apply recommended lenses
3. Generate proposed ontology updates
4. **Pause for your review**
5. Persist only what you approve

### 2. Review Proposed Updates

When the workflow suspends, you'll see:
- Proposed entity updates (new entities, perspectives)
- Proposed tensions (contradictions found)
- Insights with significance levels

Resume with your decision:
```json
{
  "approved": true,
  "approvedEntityUpdates": ["contract", "timing"],
  "approvedTensions": ["tension-1"],
  "notes": "Skipped low-confidence items"
}
```

### 3. Query the Ontology

Talk to the **research-agent** in Studio:

- "What's the GOM's mental model of contracts?"
- "Compare how Merchant and CSR view basis pricing"
- "What tensions exist between roles?"
- "What tools does the CSR use daily?"

## Tool Ecosystem Tracking

### Add a Tool
```
"Add a tool called ContractPro, category contracts, used by CSR and GOM"
```

### Track Usage
```
"Record that GOMs use ContractPro daily but find it frustrating -
they have to copy-paste from Excel first"
```

### Compare Ecosystem
```
"Show me the tool fragmentation across all personas"
```

## PoC Feature Tracking

Track your new tool's value proposition:

```
"Add a PoC feature called 'Unified Contract View' that solves the
copy-paste pain point for GOMs and replaces ContractPro and Excel"
```

Query benefits:
```
"What does our PoC solve for GOMs?"
```

## Available Lenses

| Lens | Best For | Key Output |
|------|----------|------------|
| OOUX | Entity discovery | Objects, attributes, relationships |
| JTBD | Understanding motivation | Jobs, pain points, desired outcomes |
| TaskAnalysis | Understanding workflows | Task flows, decision points, bottlenecks |
| MentalModel | Finding gaps | Misconceptions, education opportunities |
| Activity | Hierarchical goals + tools | Activities → Tasks → Operations, tool mediation |

## Tips

1. **Tag personas consistently** - always specify persona when ingesting
2. **Let it propose, you approve** - the workflow pauses for review, use it
3. **Track tools as you find them** - when a transcript mentions a tool, add it
4. **Query often** - the agent can synthesize across all your data
5. **Add lenses incrementally** - start with OOUX + JTBD, add others as needed

## Adding a New Lens

When you add a new lens, existing transcripts won't have been analyzed with it. To reprocess:

1. List transcripts: ask agent "list all transcripts"
2. For each transcript, ask agent to apply the new lens
3. Review and approve proposed updates

## Data Persistence

All research data is persisted to SQLite and survives restarts:

- **Ontology** (entities, tensions, tools, terminology): `mastra.db`
- **Transcripts**: `mastra.db` (full text, classification, topics, key quotes)
- **Evidence chains**: Links every entity and tension back to source transcripts
- **Quote bank**: All notable quotes, searchable by persona, topic, lens, or text
- **Ontology snapshots**: Automatic versioning before each analysis run
- **Traces**: `mastra.db` for debugging

## Environment Variables

```bash
ANTHROPIC_API_KEY=your-key-here
# If using corporate gateway:
ANTHROPIC_BASE_URL=https://your-gateway.com/v1
```
