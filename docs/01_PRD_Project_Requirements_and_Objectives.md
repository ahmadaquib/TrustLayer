# Doc 01 — Project Requirements & Objectives

**Project:** TrustLayer — Access-Aware RAG Gateway with Claim-Level Grounding Verification  
**Case Study:** Role-Based Banking Support Assistant (Multi-Bank, Tiered)  
**Paper Title:** *Design and Evaluation of an Access-Aware RAG Gateway with Claim-Level Grounding Verification: A Role-Based Banking Support Assistant Case Study*  
**Owner:** Aquib — BE Computer Science / Data Science (AI & ML), VCET, Mumbai University  
**Target Completion:** End of Semester 8 (Working System, Final Viva, and Springer Journal Paper)  
**Baseline / Interim Checkpoint:** 30 October 2026  
**Status Marking:** Components are explicitly tagged as `[IMPLEMENTED]` (built and verified in the interim prototype) or `[PLANNED]` (target architecture per Panel Review & Final Architecture v1.0).

---

## 1. Problem Statement

Agentic AI systems are increasingly deployed in production to take real actions on an institution's behalf — not just answer questions. Two primary failure modes exist today, which the research and industry landscape treats as disconnected problems:

- **Type-A failure (hallucination):** The agent's underlying belief or claim is factually false or ungrounded.
- **Type-B failure (unauthorized action / privilege escalation):** The agent executes an action it is not permitted to take under governance policies.

Existing research (surveying 21 papers across agent security and RAG verification) splits cleanly into two isolated camps: tool-call security/firewall systems that verify *what an agent is allowed to do* (e.g., AEGIS-style policy firewalls), and hallucination-detection systems that verify *what an agent believes is true* (e.g., HaluCheck-style RAG verifiers). **No system evaluates both failure modes together in a unified decision framework.**

### The Compound Failure Thesis
The critical vulnerability left exposed is the **compound failure**:
1. An action can be **fully authorized** under role policies yet rest upon a **hallucinated or false claim** (e.g., a customer service agent is authorized to execute fee waivers or fund transfers, but processes a ₹2,50,000 transfer because it hallucinates that the user has a Platinum ₹5,00,000 limit, when the user is actually on Standard tier with a ₹1,00,000 limit).
2. A claim can be **factually true** while the proposed action itself is **strictly illegal** for that role or tier (e.g., a bank's policy genuinely permits 90-day dispute windows, but a customer directly attempts an administrative tool call reserved for staff).

### Tier-Entitlement Hallucination
In multi-bank and tiered enterprise environments, TrustLayer introduces and addresses a specific hallucination class: the **tier-entitlement claim**. Here, a user or the agent assumes privileges, fee waivers, daily transaction limits, or expedited dispute windows that belong to a higher tier (e.g., Platinum) rather than the customer's authenticated tier (e.g., Standard). TrustLayer grounds claims against the specific bank and tier documents to eliminate entitlement hallucination before actions execute.

---

## 2. Objective

Build an access-aware agent firewall middleware — **TrustLayer** — positioned between an AI agent's reasoning step and tool execution, that jointly evaluates:
1. **Factual Grounding:** Whether the claims justifying the proposed action are factually grounded in evidence via claim-level NLI verification against an access-scoped knowledge base.
2. **Policy Authorization:** Whether the proposed action satisfies role, tier, daily limit, and workflow dependency constraints.

TrustLayer resolves both checks into a unified real-time governance decision: **ALLOW**, **APPROVE** (route to human approver), or **BLOCK** before the tool can execute.

---

## 3. Case Study Domain: Multi-Bank & Tiered Banking Support Assistant

Banking provides high-stakes financial operations, formal regulatory guidelines, hierarchical customer tiers, and established manager-approval workflows.

### 3.1 Multi-Bank & Customer Tier Model `[PLANNED]`
- **Scope for Demo and Evaluation:** 2 Banks (e.g., Bank A, Bank B) $\times$ 3 Customer Tiers (Standard, Gold, Platinum).
- **Three Decision Axes:**
  1. **Bank:** Governs which rulebook and uploaded policy documents apply (loaded from DB bank record).
  2. **Role:** Governs which tools may be attempted at all (loaded from DB user record).
  3. **Tier:** Governs transaction limits, daily caps, fees, and service entitlements (loaded from DB customer record).

> [!IMPORTANT]
> **Safety Floors (Non-Negotiable):**
> - Bank, role, and tier **always** come from the database, never from user messages or agent reasoning.
> - Safety floors are **NOT editable** by any bank or tier: role denial blocks unconditionally; ungrounded money-moving actions never auto-allow.

### 3.2 Core Agentic Capabilities (Tool Execution)
The agent performs real actions via tool calls:
- `check_balance` — Inspect account balances.
- `get_transactions` — Query statement history.
- `transfer_funds` — Transfer money between accounts (subject to tier caps and sequence checks).
- `block_card` — Freeze debit/credit cards immediately.
- `dispute_charge` — Initiate transaction disputes.
- Administrative tools: `waive_fee`, `increase_limit`, `override_hold` (restricted to staff/approver).

### 3.3 Roles
| Role | Description | Status |
|---|---|---|
| **Customer** | End user; interacts via chat with multi-turn session memory; bound to a specific tier (Standard / Gold / Platinum). | `[IMPLEMENTED]` (Roles), `[PLANNED]` (Tiers) |
| **Bank Staff / Admin** | Elevated access; monitors analytics, manages bank-specific policies and KB documents. | `[IMPLEMENTED]` (Analytics), `[PLANNED]` (Policy Console) |
| **Senior Staff / Approver** | Resolves actions routed to the human approval queue; manages policy configurations. | `[IMPLEMENTED]` (Approvals), `[PLANNED]` (Policy Admin) |

---

## 4. Functional Requirements

- **FR1 — Access-Aware Retrieval:** Knowledge base retrieval must be filtered by bank, role, and tier (`[IMPLEMENTED]` for role filtering; `[PLANNED]` for bank and tier filtering).
- **FR2 — Claim Extraction:** Extract atomic factual claims from agent reasoning traces (`[IMPLEMENTED]` via Gemini API with heuristic sentence-splitter fallback).
- **FR3 — Claim Grounding Verification:** Verify each claim against retrieved evidence chunks using NLI and compute a graduated grounding score (`[IMPLEMENTED]` via DeBERTa-v3 sentence-level NLI).
- **FR4 — Tool Interception:** Intercept all proposed tool calls prior to execution (`[IMPLEMENTED]` via FastAPI gateway interception layer).
- **FR5 — Policy & Limits Verification:** Verify action permissions, tier limits, and daily caps (`[IMPLEMENTED]` via Python RBAC matrix; `[PLANNED]` via OPA with bank configuration as data).
- **FR6 — Workflow & Sequence Checks:** Validate workflow execution order and detect anomalies (`[IMPLEMENTED]` via 5-minute $\ge 85\%$ balance drain sequence rule; `[PLANNED]` via Neo4j tool-dependency graph with NetworkX fallback).
- **FR7 — Multi-Input Risk Decision:** Fuse grounding and policy signals into a risk score gating execution into ALLOW, APPROVE, or BLOCK (`[IMPLEMENTED]` 2-input formula; `[PLANNED]` 5-input weighted risk engine with safety floors).
- **FR8 — Human-in-the-Loop Approvals:** Route borderline or high-risk actions to an Approver queue with review, approve, and reject workflows (`[IMPLEMENTED]`).
- **FR9 — Comprehensive Audit Logging:** Persist every decision with request ID, scores, tier, and policy version in Postgres (`[IMPLEMENTED]` base schema; `[PLANNED]` bank, tier, policy_version additions).
- **FR10 — Dashboard & Policy Console:** Administrative UI for analytics, approvals, tiered rule editing, and KB document uploads (`[IMPLEMENTED]` backend endpoints for analytics/approvals; `[PLANNED]` frontend UI & policy console).
- **FR11 — Isolated Tool Execution:** Execute allowed tools in an isolated environment (`[IMPLEMENTED]` in-process mock DB ledger; `[PLANNED]` Docker sandbox with read-only filesystem and no network).
- **FR12 — Template-Driven Block Replies:** Blocked responses must supply the policy reason and next step derived deterministically from policy/KB data, preventing response hallucination (`[PLANNED]`; `[IMPLEMENTED]` interim fallback string).

---

## 5. Non-Functional Requirements

- **NFR1 — Zero Budget & Open-Source:** All foundational modules must be free, open-source, or self-hosted.
- **NFR2 — Local Inference & Controlled APIs:** Embeddings (BGE-M3) and NLI (DeBERTa-v3) run locally/offline. Claim extraction uses Gemini API with deterministic heuristic fallback.
- **NFR3 — Hardware & Memory Budget (8 GB RAM):** The system must operate on an Intel i5, 8 GB RAM, no GPU host. Postgres, Neo4j, Qdrant, OPA, BGE-M3, DeBERTa, and Docker Desktop together exceed 8 GB if unmanaged.
  - *Mitigations:* Qdrant runs in embedded mode (no server process); Neo4j JVM heap capped at ~512 MB with NetworkX fallback; services started on demand during testing.
- **NFR4 — Traceability & Fixed Precision:** All decision scores must use exact database numeric types (`NUMERIC(5,4)`), correlated across all tables by a shared `request_id`.
- **NFR5 — Research Quality:** Artifacts and evaluations must satisfy rigorous academic standards for Springer journal submission.

---

## 6. Architecture Evolution: Interim Simplifications vs. Final Target Architecture

The project roadmap progressed through an interim prototype to validate core concepts, evolving into the full panel-directed architecture.

| Subsystem | Interim Prototype `[IMPLEMENTED]` | Final Target Architecture `[PLANNED]` | Rationale / Panel Direction |
|---|---|---|---|
| **Agent Core** | Custom rule-based intent matcher (`agent/loop.py`) | LangGraph with Gemini | Makes agent-generated claims genuine; enables true multi-turn autonomous reasoning. |
| **Vector Database** | PostgreSQL + pgvector | Qdrant (embedded mode behind vector-store interface) | Production-grade vector search with embedded engine footprint to respect the 8 GB RAM budget. |
| **Workflow Engine** | Rule-based sequence rule (balance check $\rightarrow$ drain $\ge 85\%$) | Neo4j dependency graph (NetworkX fallback) | Explicit state-machine validation of prerequisites (identity verified, balance checked, transfer permitted); capped at ~512 MB heap. |
| **Policy Engine** | Hardcoded Python RBAC matrix (`policy/rbac.py`) | Open Policy Agent (OPA) with config as data | Decouples policy logic from code: fixed Rego policy rules evaluate bank-specific JSON data pushed per bank/tier. |
| **Risk Engine** | 2-input weighted formula ($0.5 \times \text{grounding} + 0.5 \times \text{policy}$) | 5-input weighted risk engine + safety floors | Incorporates grounding, policy, graph status, tool sensitivity, and context risk. (No XGBoost due to lack of training data). |
| **Execution Sandbox** | In-process mock DB ledger | Docker sandbox (no network, read-only FS, mock ledger) | Provides secure containment for tool execution against simulated banking backend. |
| **Policy Management** | Hardcoded configurations | Bank Policy Console (layered overrides: bank $\rightarrow$ tier $\rightarrow$ role) | Allows administrators to update limits, rules, and upload role/tier-tagged KB documents with versioning. |
| **OpenClaw** | Not included | Optional generality demo | Out of core scope; treated as optional post-core exploration. |

---

## 7. Success Criteria

1. **End-to-End Multi-Bank Demo:** Customer from Bank A / Standard tier submits an escalated or hallucinated request $\rightarrow$ LangGraph reasons $\rightarrow$ TrustLayer intercepts $\rightarrow$ parallel Grounding (Qdrant + DeBERTa) and Firewall (OPA + Neo4j) run $\rightarrow$ 5-input risk engine enforces BLOCK/APPROVE/ALLOW $\rightarrow$ sandbox execution or template-driven safe response.
2. **Detection of Compound & Tier Failures:** Proven mitigation of authorized actions resting on false claims, role violations, and tier-entitlement claims.
3. **Rigorous Academic Evaluation:** Re-running the 97-case benchmark with genuine agent reasoning, adding tier-entitlement buckets, testing against baselines (AEGIS, HaluCheck), evaluating external benchmarks (Agent Security Bench, public hallucination dataset), and testing a 2-bank $\times$ 3-tier matrix.
4. **Deliverables:** Working software system, final viva examination, and manuscript submission to a Springer journal by the end of Semester 8.
