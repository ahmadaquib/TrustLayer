# Doc 06 — Implementation Plan

**Project:** TrustLayer — Banking Support Assistant Case Study (Multi-Bank, Tiered)  
**Timeline & Milestone:** Execution across Semester 8 $\longrightarrow$ Completion by End of Semester 8  
**Deliverables:** Production-grade working software, Final Viva Examination, and Manuscript submission to a Springer Journal  
**Build Tool:** Google Antigravity  
**Hardware & Memory Envelope:** Intel Core i5, 8 GB RAM, no GPU, zero budget  
**Status Tagging:** `[IMPLEMENTED]` (completed in the baseline prototype) vs. `[PLANNED]` (target roadmap per Panel Review & Final Architecture v1.0).

---

## 1. Baseline Prototype Status `[IMPLEMENTED]`

The baseline prototype completed in early Semester 8 successfully established the proof of concept:
- [x] PostgreSQL + `pgvector` schema running locally in Docker (`[IMPLEMENTED]`).
- [x] FastAPI gateway with session management, role resolution, and tool interception (`[IMPLEMENTED]`).
- [x] BGE-M3 1024-dim dense embeddings and DeBERTa-v3 sentence-level NLI verification (`[IMPLEMENTED]`).
- [x] Gemini structured claim extraction with sentence-splitter heuristic fallback (`[IMPLEMENTED]`).
- [x] Custom Python RBAC matrix and rule-based sequence-anomaly check (5-minute $\ge 85\%$ balance drain) (`[IMPLEMENTED]`).
- [x] Approver resolution flow (`/approvals/{id}/approve`, `/reject`) and read-only analytics endpoints (`/dashboard/summary`, `/audit`) (`[IMPLEMENTED]`).
- [x] Prior 97-case evaluation benchmark showing 100% full-pipeline accuracy and 0% FPR against compound failures (`[IMPLEMENTED]`).

---

## 2. Target 9-Step Build Order `[PLANNED]`

The build order establishes a sequential engineering progression where each step is individually testable and strictly honors the 8 GB RAM constraint:

```
[Step 1: LangGraph + Gemini Agent]
                |
                v
[Step 2: OPA Policy (Config as Data)]
                |
                v
[Step 3: Dependency Graph (NetworkX first, Neo4j adapter)]
                |
                v
[Step 4: Five-Input Risk Engine (Tuned weights, Safety Floors)]
                |
                v
[Step 5: Multi-Bank & Tier Config + KB Upload (Layered Overrides)]
                |
                v
[Step 6: Qdrant Embedded Vector Store]
                |
                v
[Step 7: Docker Execution Sandbox (No net, read-only FS)]
                |
                v
[Step 8: External Evaluation & Paper Benchmarks]
                |
                v
[Step 9: Final Figures, Documentation & Viva Preparation]
```

### Step 1: LangGraph Agent with Gemini `[PLANNED]`
- **Effort:** Medium
- **Scope:** Replace the interim rule-based intent loop (`agent/loop.py`) with a LangGraph state graph.
- **Goal:** Agent independently reasons, maintains conversation state, retrieves context, and proposes tool calls. Ensures test claims are genuinely agent-generated rather than pre-scripted, closing the primary evaluation gap in the compound-failure validation.

### Step 2: Open Policy Agent (OPA) with Configuration as Data `[PLANNED]`
- **Effort:** Low to Medium
- **Scope:** Integrate OPA daemon or local library. Define fixed, immutable Rego policies enforcing universal security invariants.
- **Goal:** Inject bank-specific policies, role matrices, and limits dynamically as JSON data documents. Lays the architectural foundation for multi-bank and tier governance.

### Step 3: Workflow Dependency Graph (NetworkX First, Neo4j Adapter) `[PLANNED]`
- **Effort:** Medium
- **Scope:** Build the workflow dependency graph behind an abstract graph interface to model action prerequisites (e.g. `verify_identity` $\rightarrow$ `check_balance` $\rightarrow$ `transfer_funds`). Implement the **NetworkX engine first as the default** in-memory graph checker. Neo4j is structured as an **optional adapter** if time and memory allow.
- **Resource Control:** Zero background daemon overhead with default NetworkX. If the optional Neo4j adapter is activated, cap its JVM heap strictly to max 512 MB (`dbms.memory.heap.max_size=512m`).

### Step 4: Five-Input Risk Engine & Safety Floor Calibration `[PLANNED]`
- **Effort:** Low
- **Scope:** Upgrade from the two-input formula ($0.5/0.5$) to the five-input weighted fusion:
  $$\text{final\_risk} = w_1 \cdot \text{grounding\_risk} + w_2 \cdot \text{policy\_risk} + w_3 \cdot \text{graph\_risk} + w_4 \cdot \text{tool\_sensitivity} + w_5 \cdot \text{context\_risk}$$
- **Threshold Tuning:** Calibrate cutlines ($<0.3$ ALLOW, $0.3\text{--}0.6$ APPROVE, $>0.6$ BLOCK) and empirically tune weights against actual validation score distributions. (No XGBoost due to zero training data).
- **Safety Floors:** Enforce non-negotiable hard floors (role denial blocks; ungrounded money-moving actions never auto-allow).

### Step 5: Multi-Bank & Tier Configuration Console + KB Ingestion `[PLANNED]`
- **Effort:** Medium
- **Scope:** Implement layered policy overrides:
  $$\text{Bank Defaults} \longrightarrow \text{Tier Rules (Standard/Gold/Platinum)} \longrightarrow \text{Role Permissions}$$
- **Policy Management:** Versioned policy tables in PostgreSQL (`policies`). Secure upload interface for compliance documents tagged with `bank_id`, `role_scope`, and `tier_scope`.

### Step 6: Qdrant Embedded Vector Store Migration `[PLANNED]`
- **Effort:** Low
- **Scope:** Implement a unified vector store interface. Transition vector storage from `pgvector` to embedded Qdrant (`qdrant-client` local in-process storage).
- **Goal:** Production-grade payload filtering (by bank, role, and tier) without the RAM overhead of a dedicated Qdrant server container.

### Step 7: Docker Tool Execution Sandbox `[PLANNED]`
- **Effort:** Medium
- **Scope:** Wrap tool executors in an isolated Docker container with `--net=none`, a read-only root filesystem, and restricted volume mounts connected solely to the mock bank ledger.
- **Goal:** Secure sandbox execution preventing unvetted side-effects.

### Step 8: External Evaluation & Academic Benchmarking `[PLANNED]`
- **Effort:** Medium to High
- **Scope:** Execute the comprehensive experimental suite for the Springer journal paper (see §3 below).

### Step 9: Final Figures, Documentation & Viva Preparation `[PLANNED]`
- **Effort:** Low
- **Scope:** Re-generate architecture diagrams and flowcharts from the finished implementation. Synchronize all project documentation, finalize viva slides, and prepare the live interactive defense demonstration.

---

## 3. Evaluation Plan for Springer Journal Paper

To establish objective academic validity beyond self-authored test sets:

1. **Re-Run Core Buckets with Real Agent:**
   - Execute the original 5 core evaluation buckets using genuine agent reasoning traces produced by the LangGraph Gemini agent, verifying that hallucinations originate autonomously from the model.
2. **Tier-Entitlement Evaluation Bucket:**
   - Introduce a new benchmark bucket testing tier-entitlement privilege escalations (e.g., Standard users claiming Platinum transfer limits, fee waivers, or instant dispute credits).
3. **Repeated Ablation Study:**
   - Re-evaluate the 3-way ablation (`rbac_only`, `grounding_only`, and `full` TrustLayer) across the complete 5-input architecture to isolate individual security contributions.
4. **Baseline Comparisons:**
   - **AEGIS-Style Baseline:** Pure policy-driven tool-call firewall without claim grounding.
   - **HaluCheck-Style Baseline:** Pure RAG claim-verification system without role/tier access control.
5. **External Benchmark Datasets:**
   - **Agent Security Bench:** Evaluate tool-call safety against standard adversarial agent prompts.
   - **Public Hallucination Dataset:** Validate domain-agnostic claim extraction and NLI grounding accuracy.
6. **Multi-Bank $\times$ Tier Grid:**
   - Evaluate identical prompts and tool actions across a $2 \text{ Banks} \times 3 \text{ Tiers}$ (Standard, Gold, Platinum) matrix, demonstrating that TrustLayer produces distinct, governance-correct outcomes based on DB-resolved metadata.

---

## 4. Hardware & Memory Management Strategy (8 GB RAM Budget)

Running Postgres, Neo4j, Qdrant, OPA, BGE-M3, DeBERTa-v3, and Docker Desktop simultaneously on an 8 GB RAM laptop without dedicated swap requires strict resource orchestration:

| Component | Execution Mode | Memory Optimization Strategy |
|---|---|---|
| **Qdrant** | Embedded Python library | In-process file storage; zero daemon RAM overhead. |
| **Dependency Graph (NetworkX / Neo4j)** | In-memory library (NetworkX default) / JVM container (optional Neo4j adapter) | Zero daemon overhead with NetworkX default; if optional Neo4j adapter is used, JVM heap capped strictly to 512 MB (`dbms.memory.heap.max_size=512m`). |
| **PostgreSQL** | Docker container | Shared memory capped to 256 MB. |
| **BGE-M3 & DeBERTa** | PyTorch CPU | Executed sequentially with thread limit (`torch.set_num_threads(2)`). |
| **Testing Harness** | On-demand orchestration | Test runners selectively boot only the specific backend dependencies required for the target test stage. |
