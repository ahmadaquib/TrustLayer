# Doc 04 — UI/UX & Dashboard Brief

**Project:** TrustLayer — Banking Support Assistant Case Study (Multi-Bank, Tiered)  
**Status Tagging:** `[IMPLEMENTED]` (backend endpoints and data logic active) vs. `[PLANNED]` (frontend UI views per Panel Review & Final Architecture v1.0).

---

## 1. Visual Identity & Design System

- **Color Palette:**
  - **Navy** `#1E3A8A` — Primary structural surfaces and headers
  - **Blue** `#2563EB` — Interactive elements, primary actions, and neutral states
  - **Green** `#059669` — Grounding-verified indicators & `ALLOW` decision badges
  - **Red** `#DC2626` — Security firewall violations & `BLOCK` decision badges
  - **Amber** `#D97706` — Pending review indicators & `APPROVE` decision badges
  - **Purple** `#7C3AED` — Multi-input risk fusion & decision engine analytics
- **Typography:** Modern typography pairing (Inter / Lora) for readability.
- **Decision State Consistency:** Decision states must map strictly to their semantic colors across all screens (`ALLOW` = Green, `APPROVE` = Amber, `BLOCK` = Red).

---

## 2. Screens by User Role

### 2.1 Customer Interface — Chat Window `[PLANNED UI]`
- **Interface Structure:** Conversational message stream, persistent multi-turn session context.
- **Execution Chips:**
  - Allowed tools display an inline confirmation chip: `[Action Completed: Funds Transferred]`.
  - Actions routed for approval display an amber review chip: `[Under Review: Pending Senior Staff Approval]`.
- **Safe Block Messages:**
  - `[IMPLEMENTED]` Interim Behavior: Displays a static fallback message (*"I can't complete that action — please contact support."*).
  - `[PLANNED]` Target Behavior: Template-driven message stating the concrete reason and next step (e.g. *"Transfer limit for your Standard tier is ₹1,00,000. Next step: You may reduce the amount or submit an application for an account tier upgrade."*).
  - **Security & Scoping Invariant `[PLANNED]`:** Under no circumstances does the customer UI display internal risk scores, model confidences, system prompts, or backend security flags. The message may name **only the user's own bank/role/tier limits and entitlements plus the next step** (e.g. request upgrade), and must **never reveal another tier's limits or rules** (e.g. never disclose Gold or Platinum limits/perks to a Standard user).

---

### 2.2 Senior Staff / Approver Interface — Approval Queue `[PLANNED UI / IMPLEMENTED Endpoints]`
*(Backed by implemented endpoints `GET /approvals/pending`, `POST /approvals/{id}/approve`, `POST /approvals/{id}/reject`)*

- **Queue View:** Real-time queue sorted newest first. Displays originating customer, bank, tier, requested tool, trigger reason (grounding/policy/graph/floor), and age.
- **Deep-Inspection Modal / Detail Pane:**
  - **Original Request:** Customer query and session context.
  - **Agent Reasoning & Claims:** Extracted atomic claims and confidence scores.
  - **Grounding Evidence:** Retrieved evidence chunks from the knowledge base, highlighting matching sentences and NLI entailment/contradiction probabilities.
  - **Firewall & Graph Check:** OPA rule evaluated, limit comparison, and sequence status.
  - **Risk Engine Breakdown:** Individual risk scores (`grounding_risk`, `policy_risk`, `graph_risk`, `tool_sensitivity`, `context_risk`) and final risk score.
- **Action Controls:**
  - **Approve Button (Green):** Triggers execution inside the isolated sandbox container and sets DB status to `approved`.
  - **Reject Button (Red):** Blocks tool execution permanently and sets status to `rejected`.
  - **Audit Note Input:** Mandatory or optional justification string written to `audit_log.reason`.

---

### 2.3 Staff / Admin Interface — Analytics Dashboard `[PLANNED UI / IMPLEMENTED Endpoints]`
*(Backed by implemented endpoints `GET /dashboard/summary` and `GET /audit`)*

- **Top-Level KPI Row:**
  - Total requests processed.
  - Breakdown percentages: `% ALLOW` (Green), `% APPROVE` (Amber), `% BLOCK` (Red).
  - Average Grounding Score and Average Risk Score across decisions.
  - Average End-to-End Latency.
- **Decision Volume Chart:** Stacked time-series chart showing decision volume broken down by decision type.
- **Security & Anomaly Tables:**
  - Sequence-anomaly triggers (e.g., balance check followed by $\ge 85\%$ account drain).
  - Role-denial and tier-limit violations log.
- **Degraded Mode & Fallback Indicator:** Displays frequency of `grounding_unavailable` or `policy_engine_error` events, identifying external API or infrastructure degradation.

---

### 2.4 Staff / Admin Interface — Bank Policy Console `[PLANNED]`
*(Target management console for multi-bank and tier governance)*

- **Bank & Tier Selector:**
  - Dropdown to switch active bank view (e.g., Bank A vs. Bank B).
  - Tier tabs: **Standard**, **Gold**, **Platinum**.
- **Rule & Limit Editor (Layered Overrides):**
  - **Tool Permissions Matrix:** Toggle tool permissions (`allow` / `deny`) per role.
  - **Limits & Caps:** Set per-transaction limits, daily transfer caps, and dispute eligibility windows per tier.
  - **Safety Floor Lock:** Safety floors (role denial blocks, ungrounded money-moving actions never auto-allow) are permanently locked with a visual padlock icon indicating they cannot be disabled by any bank or tier.
- **Knowledge Base Document Uploader:**
  - Upload interface for bank compliance documents (PDF/Text).
  - Role tag selector (`role_scope`: customer, staff, approver).
  - Tier tag selector (`tier_scope`: standard, gold, platinum).
  - Automatic chunking and embedding status indicator (BGE-M3 $\rightarrow$ Qdrant).
- **Audit & Version History:**
  - Version increment badge (`v7`, `v8`).
  - History log displaying who made changes (`created_by`), timestamp, and JSON diff of modified rules.

---

## 3. Core UX Invariants

1. **Role-Scoped Transparency:** Staff and Approvers see full risk breakdowns, evidence chunks, and rule flags. Customers see only clean execution feedback and template-driven instructions.
2. **Deterministic Block Messaging:** Block replies are generated strictly via secure templates populated from authorized DB data—never free-form LLM generation.
3. **Double-Action Prevention:** Once an approval action is resolved, buttons disable immediately to prevent duplicate execution (`409 Conflict` safety).
