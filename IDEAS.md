# Research Agent Enhancement Ideas

Future enhancements for the cognitive research agent system.

## Data Ingestion

- **Batch MD ingestion workflow** - point at a folder, process all transcripts with persona auto-detection
- **Transcript anonymizer processor** - strip names, companies, PII before analysis
- **Audio transcription integration** - Whisper API to ingest recordings directly
- **Session recording parser** - extract insights from FullStory/Hotjar session notes

## Analysis Lenses

- **Sentiment lens** - track emotional tone per persona, per topic, over time
- **Quote bank** - auto-extract and tag quotable moments with persona/topic/sentiment
- **Terminology extractor** - build glossary of how each persona talks vs. system terminology
- **Pain point severity scorer** - frequency × impact matrix from evidence
- **Competitive lens** - compare existing tools to PoC feature-by-feature

## Ontology Evolution

- **Confidence decay** - insights weaken over time without fresh evidence
- **Evidence chain tracking** - every insight links to source transcripts + quotes
- **Auto conflict detection** - flag when new data contradicts existing ontology
- **Ontology versioning** - snapshot state before/after each analysis, track evolution
- **Merge tool** - reconcile insights when two researchers analyze same persona

## Artifact Generation

Priority area - stakeholder alignment requires polished outputs.

- **Persona profile generator** - auto-generate "Day in the life of a GOM" doc
- **PoC pitch deck generator** - per-persona value prop with evidence
- **Stakeholder digest workflow** - weekly summary of new insights, tensions, questions
- **Feature prioritization matrix** - score PoC features by pain points solved × personas affected
- **Executive summary generator** - TL;DR for leadership with key findings and recommendations
- **Comparison reports** - "How Merchant vs CSR view X" with side-by-side evidence

## Infrastructure

- **Vector store + semantic search** - "find all mentions of contract frustration" across 100 transcripts
- **MCP server exposure** - let other tools (IDE, Slack bot, web app) query the ontology

## Workspaces

- **Transcript folder ingestion** - point workspace at `/transcripts` folder, auto-index all MD files
- **Semantic search across corpus** - BM25 + vector search to query across all ingested transcripts
- **Artifact output folder** - agent writes generated profiles, pitch decks, summaries to `/artifacts`
- **Research skills library** - reusable SKILL.md files for common research patterns:
  - `deep-dive-persona` - comprehensive single-persona analysis
  - `compare-roles` - cross-role mental model comparison
  - `evidence-chain` - build citation chains from insights to quotes
  - `tool-audit` - comprehensive tool ecosystem mapping
  - `tension-discovery` - systematic inter-role tension finding
- **Cloud storage mount** - S3/GCS for team-shared transcript corpus
- **Read-only transcript access** - prevent agent from modifying source transcripts
- **Auto-reindex on file change** - watch folder for new transcripts, index automatically

## Quality & Evaluation (Scorers)

- **Insight quality scorer** - rate actionability, evidence strength, specificity (0-1)
- **Lens effectiveness scorer** - compare which lenses yield best results per persona/context
- **Tension validity scorer** - LLM-as-judge to validate proposed tensions have real evidence
- **Entity extraction accuracy** - score how well OOUX extracts real entities vs noise
- **Expectation gap scorer** - measure meaningfulness of surprises vs confirmations
- **Persona classification confidence** - score how clearly content maps to a persona
- **Cross-transcript consistency** - flag when new insights contradict existing ontology
- **Evidence chain completeness** - score whether insights link back to source quotes

## Stakeholder-Tailored Outputs

Instead of separate agents, use targeted prompts to generate outputs for different stakeholders:

- **IT Manager lens** - systems integration, data flows, technical debt, architecture implications
- **Product Manager lens** - user pain points, feature opportunities, persona needs, prioritization
- **Executive lens** - ROI, strategic alignment, risk, timeline (no jargon)
- **Design lens** - workflows, friction points, UI implications, mental model gaps

Could implement as:
- Prompt templates per stakeholder type
- Output format presets in the agent instructions
- Workflow steps that transform research findings into stakeholder-specific artifacts

## Notes

Artifact generation is critical - need to translate research into formats that resonate with stakeholders who don't have time to dig into raw findings.
