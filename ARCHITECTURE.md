# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER WORKSTATION                                  │
│                                                                             │
│  ┌─────────────┐    ┌──────────────────────────────────────────────────┐   │
│  │   Browser   │    │              Mastra Application                   │   │
│  │             │◄──►│                                                    │   │
│  │ localhost:  │    │  ┌─────────────┐  ┌────────────────────────────┐ │   │
│  │    4111     │    │  │   Studio    │  │     Research Agent         │ │   │
│  │             │    │  │     UI      │  │                            │ │   │
│  └─────────────┘    │  └─────────────┘  │  • Transcript Ingestion    │ │   │
│                     │                    │  • Lens Analysis           │ │   │
│                     │  ┌─────────────┐  │  • Ontology Management     │ │   │
│                     │  │  Workflows  │  │  • Tool Ecosystem Tracking │ │   │
│                     │  │             │  └────────────────────────────┘ │   │
│                     │  │ Human-in-   │                                  │   │
│                     │  │ the-loop    │  ┌────────────────────────────┐ │   │
│                     │  │ Review Gate │  │      SQLite Database       │ │   │
│                     │  └─────────────┘  │       (mastra.db)          │ │   │
│                     │                    │                            │ │   │
│                     │                    │  • Ontology entities       │ │   │
│                     │                    │  • Role perspectives       │ │   │
│                     │                    │  • Tensions & insights     │ │   │
│                     │                    │  • Tool mappings           │ │   │
│                     │                    │  • Observability traces    │ │   │
│                     │                    └────────────────────────────┘ │   │
│                     └──────────────────────────────────────────────────┘   │
│                                          │                                  │
└──────────────────────────────────────────┼──────────────────────────────────┘
                                           │
                                           │ HTTPS (TLS 1.2+)
                                           │ API Key Auth
                                           ▼
                              ┌────────────────────────┐
                              │   Anthropic Claude API │
                              │   (api.anthropic.com)  │
                              │                        │
                              │  • Model inference     │
                              │  • No data retention   │
                              │    for training        │
                              └────────────────────────┘
```

## Components

### Local Components (On-Premise)

| Component | Description | Data Stored |
|-----------|-------------|-------------|
| **Mastra Studio** | Web UI for interacting with agents/workflows | None (stateless UI) |
| **Research Agent** | AI agent with analytical tools | None (stateless) |
| **Workflows** | Human-in-the-loop processing pipelines | Execution state during runs |
| **SQLite Database** | Local file-based persistence | All research data (see below) |

### External Services

| Service | Purpose | Data Sent | Data Retained |
|---------|---------|-----------|---------------|
| **Anthropic API** | LLM inference for analysis | Transcript text, prompts | None (per API policy) |

## Data Flow

### Transcript Ingestion Flow

```
1. User pastes transcript    ──►  2. Agent receives input
   in Studio UI
                                      │
                                      ▼
3. Transcript sent to        ◄──  Anthropic API processes
   Claude for analysis               with analytical lenses
                                      │
                                      ▼
4. Proposed updates          ──►  5. Workflow SUSPENDS
   generated                         for human review
                                      │
                                      ▼
6. User approves/rejects     ──►  7. Approved updates
   in Studio UI                      persisted to SQLite
```

### Data at Rest

| Data Type | Storage Location | Encryption |
|-----------|------------------|------------|
| Research ontology | `mastra.db` (local SQLite) | OS-level disk encryption |
| Transcripts | `mastra.db` (local SQLite) | OS-level disk encryption |
| Evidence chains | `mastra.db` (local SQLite) | OS-level disk encryption |
| Quote bank | `mastra.db` (local SQLite) | OS-level disk encryption |
| Ontology snapshots | `mastra.db` (local SQLite) | OS-level disk encryption |
| API credentials | `.env` file (gitignored) | N/A (local file permissions) |
| Observability traces | `mastra.db` | OS-level disk encryption |

### Data in Transit

| Path | Protocol | Authentication |
|------|----------|----------------|
| Browser ↔ Mastra | HTTP (localhost only) | None (local) |
| Mastra ↔ Anthropic | HTTPS (TLS 1.2+) | API Key |

## Security Boundaries

```
┌─────────────────────────────────────────────┐
│           TRUST BOUNDARY: Workstation       │
│                                             │
│  • All research data stays here             │
│  • SQLite DB never leaves machine           │
│  • No inbound network connections           │
│                                             │
└─────────────────────────────────────────────┘
                      │
                      │ Outbound only
                      ▼
┌─────────────────────────────────────────────┐
│           Anthropic API                     │
│                                             │
│  • Receives: prompts + transcript text      │
│  • Returns: analysis results                │
│  • Retains: nothing (API data policy)       │
│                                             │
└─────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Node.js | 18+ |
| Framework | Mastra | 1.3.x |
| Database | SQLite (LibSQL) | 3.x |
| LLM Provider | Anthropic Claude | claude-sonnet-4-5 |
| Language | TypeScript | 5.x |

## Deployment Model

**Current:** Single-user local deployment on researcher workstation

**No cloud infrastructure required.** Application runs entirely on local machine with outbound API calls only.
