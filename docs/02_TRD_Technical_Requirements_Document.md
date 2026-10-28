# Doc 02 — Technical Requirements Document (TRD)

**Project:** TrustLayer — Banking Support Assistant Case Study (Multi-Bank, Tiered)  
**Status Tagging:** Every component is explicitly designated as `[IMPLEMENTED]` (operational in current prototype) or `[PLANNED]` (target architecture per Panel Review & Final Architecture v1.0).

---

## 1. Target Tech Stack

| Layer | Choice | Status | Technical Details & Architectural Rationale |
|---|---|---|---|
| **Agent Orchestration** | LangGraph with Gemini (`gemini-flash-latest` / `gemini-flash-lite-latest`) | `[PLANNED]` | Replaces the interim rule-based intent loop (`agent/loop.py` `[IMPLEMENTED]`). Enables genuine autonomous multi-turn reasoning and tool invocation traces. |
| **Interception Layer** | FastAPI Gateway | `[IMPLEMENTED]` | Intercepts proposed tool calls at the agent execution boundary before any side-effect occurs. |
| **Embeddings** | BGE-M3 (`BAAI/bge-m3`) | `[IMPLEMENTED]` | Local offline inference, 1024-dim dense embeddings cached locally (`backend/models_cache`). |
| **Vector Store** | Qdrant (Embedded Mode) | `[PLANNED]` | Sits behind an abstract vector-store interface. Runs in-process (embedded engine) to conserve RAM; replaces interim `pgvector` (`[IMPLEMENTED]`). |
| **Claim Extraction** | Gemini API (structured JSON output) | `[IMPLEMENTED]` | Cloud extraction with a deterministic sentence-splitter heuristic fallback (`[IMPLEMENTED]`) when API is unreachable. |
| **NLI Verification** | `cross-encoder/nli-deberta-v3-base` | `[IMPLEMENTED]` | Local inference; sentence-level candidate matching against evidence chunks to avoid cross-attention dilution. |
| **Policy Engine** | Open Policy Agent (OPA) | `[PLANNED]` | Fixed Rego governance rules evaluating bank configuration pushed as JSON data. Replaces interim Python RBAC (`[IMPLEMENTED]`). |
| **Workflow / Dependency Graph** | NetworkX (default) with optional Neo4j adapter | `[PLANNED]` | Enforces prerequisite action sequences behind a graph interface (e.g., verify identity $\rightarrow$ check balance $\rightarrow$ transfer). NetworkX is the default in-memory engine; Neo4j is an optional adapter if time and memory allow (JVM heap capped at ~512 MB). Replaces single rule-based sequence check (`[IMPLEMENTED]`). |
| **Risk / Decision Engine** | 5-Input Weighted Fusion + Fixed Safety Floors | `[PLANNED]` | Fuses grounding risk, policy risk, graph status, tool sensitivity, and context risk. (No XGBoost due to zero training data). Supersedes 2-input formula (`[IMPLEMENTED]`). |
| **Execution Sandbox** | Docker Sandbox (Isolated Container) | `[PLANNED]` | Tool execution with no network access and a read-only filesystem against the mock ledger. Upgrades in-process mock ledger (`[IMPLEMENTED]`). |
| **Audit & Storage** | PostgreSQL | `[IMPLEMENTED]` | Stores users, accounts, transactions, audit log, and decision records with fixed-precision `NUMERIC(5,4)` scores. |
| **Management UI** | React + Vite Dashboard & Policy Console | `[PLANNED]` | UI for decisions, approvals, analytics, layered policy configuration, and KB document upload. (Endpoints `[IMPLEMENTED]`). |
| **Agent Benchmarking** | OpenClaw | `[PLANNED]` | Optional generality demo framework; strictly out of core scope. |

---

## 2. System Architecture & Memory Budget

### 2.1 End-to-End Pipeline
```
User (Customer / Staff / Approver)
   [Bank, Role, Tier loaded from DB]
                |
                v
      FastAPI Gateway (Interception)
                |
                v
       LangGraph Agent (Gemini) [PLANNED]
   (Proposes Tool Call + Generates Response)
                |
                v
      TrustLayer Interception Boundary
                |
        +-------+-------------------------------+
        |                                       |
        v                                       v
[Engine 5A: Grounding]                 [Engine 5B: Security Firewall]
- Extract claims (Gemini) [IMPL]       - Load policy config (OPA) [PLANNED]
- Embed claims (BGE-M3) [IMPL]         - Permissions & Limits (Role/Tier) [PLANNED]
- Vector search (Qdrant [PLANNED] /    - Dependency graph (Neo4j [PLANNED])
  pgvector [IMPL], Bank/Role/Tier)     - Sequence anomaly check [IMPL]
- Sentence-level NLI (DeBERTa) [IMPL]  - Policy risk score (0 to 1) [IMPL]
- Grounding score (0 to 1) [IMPL]
        |                                       |
        +-------+-------------------------------+
                |
                v
[Section 6: Decision & Risk Engine]
Inputs: Grounding, Policy, Graph Status, Tool Sensitivity, Context Risk
Gated by Non-Negotiable Safety Floors
                |
        +-------+-----------------------+
        |                               |                               |
        v                               v                               v
      ALLOW                          APPROVE                          BLOCK
 (Risk < 0.3)                   (0.3 <= Risk <= 0.6)              (Risk > 0.6)
        |                               |                               |
        v                               v                               v
Docker Sandbox Execution          Senior Staff / Approver       Action NOT executed;
(No network, read-only FS)        Queue (Approve -> Sandbox)    Template-driven safe
        |                               |                       reply (reason + next step)
        +-------------------------------+                               |
                        |                                               |
                        +-----------------------+-----------------------+
                                                |
                                                v
                                        PostgreSQL Audit Log
                               (Scores, Bank, Tier, Policy Version)
                                                |
                                                v
                                  Dashboard & Bank Policy Console
```

### 2.2 Memory Budget for 8 GB RAM Hardware
Target Environment: Intel Core i5, 8 GB RAM, no dedicated GPU.  
Running Postgres, Neo4j, Qdrant, OPA, BGE-M3 (1024-dim), DeBERTa-v3, and Docker Desktop concurrently on 8 GB RAM creates severe memory pressure.

**Architectural Budget & Resource Mitigations:**
1. **Qdrant Embedded Mode:** Run Qdrant in-process via python bindings (`qdrant-client` embedded storage) behind a vector store interface, avoiding a separate daemon container/process.
2. **Dependency Graph (NetworkX Default / Neo4j Adapter):** Build the graph engine behind an abstract interface with **NetworkX as the default** in-memory engine (zero daemon overhead). Neo4j is structured as an optional adapter; if activated, cap JVM heap to max 512 MB (`dbms.memory.heap.initial_size=256m`, `dbms.memory.heap.max_size=512m`).
3. **Selective Process Launching:** In development and testing, run only the background services strictly required for the test target (e.g., test grounding without Neo4j running).
4. **Local Model Offloading:** BGE-M3 and DeBERTa-v3 execute sequentially on CPU with PyTorch inference threads capped (`torch.set_num_threads(2)`).

---

## 3. Claim Grounding Engine (Engine 5A)

1. **Claim Extraction `[IMPLEMENTED]`:** The agent produces reasoning referencing factual justifications. Gemini extracts atomic propositions in structured JSON. If the API fails after retries, a heuristic sentence-splitter acts as fallback.
2. **Access-Aware Retrieval:**
   - `[IMPLEMENTED]`: Filtered by requesting user's `role_scope` in PostgreSQL `pgvector`.
   - `[PLANNED]`: Multi-tenant filtering keyed on `bank_id`, `role_scope`, and `tier_scope` in Qdrant (embedded mode).
3. **Sentence-Level NLI Verification `[IMPLEMENTED]`:** Retrieved chunks are split into constituent sentences. DeBERTa-v3 evaluates candidate sentence pairs individually. If any sentence yields entailment probability $> 0.5$, the chunk is classified as `ENTAILED`.
4. **Relevance-Gated Contradiction `[IMPLEMENTED]`:** Chunks with cosine similarity $< 0.65$ to the claim cannot trigger a `CONTRADICTION` classification, eliminating false-positive penalties from off-topic chunks.
5. **Graduated Grounding Score Formula `[IMPLEMENTED]`:**
   - $\text{GS}_{\text{base}} = \frac{1}{N} \sum_{i=1}^N \max(\text{entailment\_prob}_i)$
   - $\text{Penalty} = \text{mean}(P(\text{contradiction}) \text{ for contradicted claims}) \times \left(\frac{N_{\text{contradicted}}}{N}\right)$
   - $\text{grounding\_score} = \max(0.0, \text{GS}_{\text{base}} \times (1.0 - \text{Penalty}))$
   - $\text{grounding\_risk} = 1.0 - \text{grounding\_score}$

---

## 4. Tool-Call Security Firewall (Engine 5B)

1. **OPA Policy with Bank Config as Data `[PLANNED]`:**
   - Fixed Rego rules validate general access invariants.
   - Bank-specific policies (role permissions, per-tool limits, tier caps) are pushed as structured JSON data into OPA.
   - Supersedes the hardcoded Python RBAC matrix (`[IMPLEMENTED]` in `policy/rbac.py`).
2. **Hierarchical Overrides `[PLANNED]`:**
   $$\text{Bank Defaults} \longrightarrow \text{Tier Rules (Standard/Gold/Platinum)} \longrightarrow \text{Role Permissions}$$
3. **Workflow Dependency Graph `[PLANNED]` (NetworkX default / optional Neo4j adapter):**
   - Built behind an abstract graph interface. **NetworkX is the default** in-memory engine (zero daemon overhead). Neo4j is an optional adapter if time and memory allow (JVM heap capped at ~512 MB).
   - Validates that mandatory prerequisite steps occurred prior to high-stakes actions (e.g., `verify_identity` $\rightarrow$ `check_balance` $\rightarrow$ `transfer_funds`).
   - If a prerequisite step is absent or executed out of order, graph risk is flagged.
4. **Sequence Anomaly Check `[IMPLEMENTED]`:**
   - Flags an immediate `transfer_funds` draining $\ge 85\%$ of the account balance within 5 minutes of a `check_balance` call without re-authentication (`policy_risk = 0.8`).
5. **Output:** `policy_risk` scored from 0.0 (fully compliant) to 1.0 (hard violation).

---

## 5. Decision and Risk Engine

### 5.1 Inputs to the Decision Engine
The target engine combines five risk signals:
1. `grounding_risk` ($1.0 - \text{grounding\_score}$) `[IMPLEMENTED]`
2. `policy_risk` (Python RBAC limit checks `[IMPLEMENTED]`; OPA `[PLANNED]`)
3. `graph_risk` (Dependency graph prerequisite violations) `[PLANNED]`
4. `tool_sensitivity` (Static/configurable criticality of the tool, e.g. read-only vs money-moving) `[PLANNED]`
5. `context_risk` (Session anomaly markers, e.g., IP change or rapid repeat requests) `[PLANNED]`

### 5.2 Decision Formula & Tuning Status

#### Current / Two-Input Formula `[IMPLEMENTED]`:
$$\text{final\_risk} = 0.5 \times \text{grounding\_risk} + 0.5 \times \text{policy\_risk}$$

#### Target Five-Input Formula `[PLANNED]`:
$$\text{final\_risk} = w_1 \cdot \text{grounding\_risk} + w_2 \cdot \text{policy\_risk} + w_3 \cdot \text{graph\_risk} + w_4 \cdot \text{tool\_sensitivity} + w_5 \cdot \text{context\_risk}$$
> [!NOTE]
> **Weights Status:** The five-input weights are currently undefined. **Weights set during threshold tuning (after step 4)** based on empirical validation distributions. Do not invent speculative weights.

#### Decision Thresholds:
- $\text{final\_risk} < 0.3 \longrightarrow$ **`ALLOW`**
- $0.3 \le \text{final\_risk} \le 0.6 \longrightarrow$ **`APPROVE`** (routes to Approver queue)
- $\text{final\_risk} > 0.6 \longrightarrow$ **`BLOCK`**

### 5.3 Non-Negotiable Safety Floors (Inviolable Invariants)
Safety floors cannot be overridden or edited from the policy console for any bank or tier:
1. **Role Denial Hard Override:** If an action is forbidden for a role, it triggers an immediate **`BLOCK`** (`policy_risk = 1.0`), regardless of grounding score or context.
2. **Ungrounded Money-Moving Action Floor:** If $\text{grounding\_score} < 0.4$ on any money-moving tool (`transfer_funds`, `block_card`, `dispute_charge`, `waive_fee`, `override_hold`), the outcome is floored at **`APPROVE`** (or `BLOCK`), **never `ALLOW` outright**.
   - *Active Status Note:* Under the current two-input equal weighting ($0.5/0.5$), if $\text{grounding\_score} < 0.4$, $\text{grounding\_risk} > 0.6$, yielding $\text{final\_risk} \ge 0.5 \times 0.6 = 0.3$, which already reaches `APPROVE` on its own. The floor rule is currently mathematically subsumed under equal weighting and is not the sole deciding factor today. It serves as **defense-in-depth that becomes active once the five-input weights are unequal**.
3. **Database-Sourced Authority:** Role and tier are loaded strictly from the authenticated database record, never extracted from user chat input or agent reasoning traces.

---

## 6. Execution Sandbox & Fail-Safe Paths

### 6.1 Tool Execution
- **Interim `[IMPLEMENTED]`:** Executes directly against an in-process PostgreSQL mock ledger.
- **Final `[PLANNED]`:** Runs inside an ephemeral Docker sandbox container with `--net=none`, a read-only root filesystem, and restricted volume mounts communicating solely with the mock bank ledger service.

### 6.2 Fail-Safe Behaviors `[IMPLEMENTED]`
- **Grounding Infrastructure Failure (Gemini/NLI timeout or crash):**
  - Money-moving actions: Floor enforced at `APPROVE`, logged as `event = 'grounding_unavailable'`. Never fail-open.
  - Read-only actions (`check_balance`, `get_transactions`): Fail-open with warning logged.
- **Policy Engine Failure (OPA / Python exception):**
  - Fail-closed: Forces immediate `BLOCK` (`policy_risk = 1.0`), logged as `event = 'policy_engine_error'`.

---

## 7. Evaluation Plan & Empirical Results

### 7.1 Prior Benchmark Results (97 Cases across 10 Buckets) `[IMPLEMENTED]`
Evaluated against `eval/cases.json` + `eval/hard_cases.json` across 3 configurations:
- **`rbac_only`:** 53/97 accuracy (**54.6%**) — completely blind to false reasoning claims.
- **`grounding_only`:** 82/97 accuracy (**84.5%**) — completely blind to role privilege escalation.
- **`full` (TrustLayer):** 97/97 accuracy (**100.0%**) with **0.0% False Positive Rate (FPR)** on benign cases.

### 7.2 Extended Evaluation Plan for Springer Journal Paper `[PLANNED]`
To provide independent academic rigor beyond self-authored test suites:
1. **Real LangGraph Agent Re-run:** Re-run the existing 5 core buckets using genuine reasoning traces from the LangGraph Gemini agent, ensuring claims are authentically agent-generated.
2. **Tier-Entitlement Bucket:** Introduce a dedicated test bucket evaluating tier privilege escalation (e.g., Standard users claiming Platinum transfer limits or fee waivers).
3. **Ablation Studies:** Repeat the 3-way ablation (`rbac_only`, `grounding_only`, `full`) across the updated 5-input architecture.
4. **External Baselines:**
   - **AEGIS-Style Baseline:** Pure tool-call policy firewall without grounding verification.
   - **HaluCheck-Style Baseline:** Pure claim grounding verification without role/tier access control.
5. **External Benchmark Datasets:**
   - **Agent Security Bench:** For evaluating tool-call safety and vulnerability detection.
   - **Public Hallucination Benchmark:** For domain-independent claim grounding accuracy.
6. **Multi-Bank $\times$ Tier Grid:** Execute identical requests across a matrix of 2 Banks $\times$ 3 Tiers (Standard, Gold, Platinum) to demonstrate distinct, policy-governed outcomes.
