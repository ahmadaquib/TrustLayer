# TrustLayer

**An access-aware RAG gateway that checks an AI agent's proposed actions before they execute.**
Case study: a role-based banking support assistant.

> **Status:** in active development (backend pipeline working, dashboard in progress). Target completion: end of October 2026.

## The problem

AI agents that take real actions can fail in two ways, and most work treats them separately:

- **Unauthorized action:** the agent does something its user's role is not allowed to do.
- **Ungrounded claim:** the agent acts on a claim that is false (a hallucination), even though the action itself is permitted.

The dangerous case is the combination: a fully authorized action that rests on a false claim, such as processing a refund because the agent "believes" a policy applies when it does not. A permission check alone cannot catch it, and a hallucination check alone cannot catch an unauthorized action.

## What TrustLayer does

TrustLayer sits between the agent's reasoning step and tool execution. For every proposed tool call it runs two checks and combines them into one decision:

1. **Claim grounding**
   - Extract the atomic claims behind the action (Gemini API, with a heuristic fallback).
   - Retrieve evidence from the knowledge base, filtered by the user's role (pgvector + BGE-M3 embeddings).
   - Verify each claim against the evidence with an NLI model (DeBERTa-v3) and compute a grounding score.
2. **Policy check**
   - Role-based access control (customer, staff, approver).
   - A rule-based sequence-anomaly check (for example, a balance check followed by a near-total transfer).

A decision engine then returns **ALLOW**, **BLOCK**, or **APPROVE** (routed to a senior staff member). Every decision is written to an audit log with a shared request ID. Failures fail closed for money-moving actions.

## Architecture

```
User -> FastAPI gateway -> Agent (proposes tool call)
                              |
                      TrustLayer interception
                      /                      \
          Claim grounding                Policy / RBAC
   (extract, retrieve, NLI verify)   (permissions, sequence check)
                      \                      /
                         Decision engine
                    ALLOW / BLOCK / APPROVE
                              |
              Mock bank ledger  |  Approver queue
                              |
                  Audit log (PostgreSQL)
```

## Tech stack

| Area | Technology |
|---|---|
| API | FastAPI, Pydantic, Uvicorn |
| Database | PostgreSQL with pgvector, SQLAlchemy (async), Alembic migrations |
| Embeddings | BGE-M3 (sentence-transformers), run locally |
| Verification | DeBERTa-v3 NLI cross-encoder (Hugging Face Transformers), run locally |
| Claim extraction | Google Gemini API |
| Frontend | React, TypeScript, Vite |

## Repository layout

```
backend/    FastAPI service: auth, agent loop, grounding, policy, decision engine, audit, API
frontend/   React dashboard: customer chat, approver queue, admin analytics
docs/       Planning documents: requirements, technical design, request flow, schema, plan
```

Backend modules live under `backend/src/trustlayer/`: `grounding/`, `policy/`, `decision/`, `agent/`, `audit/`, `api/`, `auth/`, `db/`.

## Getting started (backend)

Requirements: Python 3.11+, [uv](https://docs.astral.sh/uv/), PostgreSQL with the pgvector extension (for example the `pgvector/pgvector:pg16` Docker image).

```bash
git clone https://github.com/ahmadaquib/TrustLayer.git
cd TrustLayer/backend
cp .env.example .env        # set DATABASE_URL, GEMINI_API_KEY, HF_TOKEN
uv sync
uv run alembic upgrade head
uv run uvicorn trustlayer.main:app --reload
```

The embedding and NLI models download on first use into `backend/models_cache`.

## Project status

- [x] Role-aware knowledge retrieval and claim-level NLI grounding
- [x] RBAC policy engine and sequence-anomaly rule
- [x] Decision engine (ALLOW / BLOCK / APPROVE) with fail-closed behavior
- [x] Audit log with request-ID correlation
- [x] Rule-based agent loop with mock banking tools
- [ ] Dashboard UI (customer chat, approver queue, admin analytics)
- [ ] Evaluation harness and results write-up
- [ ] LangGraph-based agent

## Limitations

- The agent is currently a rule-based intent loop, not an LLM agent.
- Claim extraction needs an internet connection and a Gemini API key.
- This is a single-instance demo with a mocked ledger, not a production service.
- NLI models are weak on numeric and unit reasoning, so those claims need extra care.

## Documentation

Design rationale and requirements are in [`docs/`](docs/).
