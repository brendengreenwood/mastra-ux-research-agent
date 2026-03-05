# Cognitive Research Agent

A Mastra-based research agent for analyzing UX research data across multiple personas in the grain origination domain.

## Setup

```bash
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

## Run

```bash
npx mastra dev
# Open http://localhost:4111
```

## Documentation

- [User Guide](./USER_GUIDE.md) - How to use the system
- [Ideas](./IDEAS.md) - Future enhancement ideas

## Architecture

- **Research Agent** - Cognitive analysis with 6 lenses (OOUX, JTBD, TaskAnalysis, MentalModel, Activity)
- **Human-in-the-loop Workflow** - Review proposed ontology updates before persisting
- **Tool Ecosystem Tracking** - Map software tools across personas
- **PoC Feature Tracking** - Track new tool benefits by persona

## Personas

| ID | Role |
|----|------|
| `merchant` | Merchant |
| `grain_origination_merchant` | Grain Origination Merchant |
| `csr` | Customer Service Rep |
| `strategic_account_rep` | Strategic Account Rep |
