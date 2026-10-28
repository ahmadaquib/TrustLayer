# Doc 03 — App / Request Flow

**Project:** TrustLayer — Banking Support Assistant Case Study (Multi-Bank, Tiered)  
**Status Tagging:** `[IMPLEMENTED]` (operational in current build) vs. `[PLANNED]` (target architecture per Panel Review & Final Architecture v1.0).

---

## 1. Final End-to-End Flow (Steps 1–8)

The target request flow spans 8 sequential steps, connecting user interaction, dual verification engines, decision gating, execution, and administrative interfaces.

```
+-----------------------------------------------------------------------------------+
| 1. User Request (Customer, Staff, or Approver)                                    |
|    - Bank, role, and tier loaded strictly from the DB (never from message or LLM) |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 2. LangGraph Agent (Gemini) [PLANNED]                                             |
|    - Reasons over prompt + multi-turn history and proposes tool calls             |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 3. TrustLayer Interception [IMPLEMENTED]                                          |
|    - Pauses every proposed action before execution                                |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 4. Claim and Action Extraction [IMPLEMENTED]                                      |
|    - Gemini structured extraction with heuristic sentence-splitter fallback      |
+-----------------------------------------------------------------------------------+
                                         |
                +------------------------+------------------------+
                |                                                 |
                v                                                 v
+------------------------------------+   +------------------------------------+
| 5A. Claim Grounding Engine         |   | 5B. Tool-Call Security Firewall    |
| 5A.1 Embed claims (BGE-M3) [IMPL]  |   | 5B.1 Load policy (OPA config-      |
| 5A.2 Vector search (Qdrant         |   |      as-data) [PLANNED]            |
|      [PLANNED] / pgvector [IMPL],  |   | 5B.2 Permissions & limits (role,   |
|      bank/role/tier filter)        |   |      tier, daily caps) [PLANNED]   |
| 5A.3 Retrieve evidence (sentence-  |   | 5B.3 Dependency graph (Neo4j       |
|      level chunks) [IMPL]          |   |      workflow steps) [PLANNED]     |
| 5A.4 DeBERTa NLI (entail, neutral, |   | 5B.4 Sequence check (missing       |
|      contradict) [IMPL]            |   |      steps, drain pattern) [IMPL]  |
| 5A.5 Grounding score (0 to 1,      |   | 5B.5 Policy risk (violations       |
|      contradiction penalty) [IMPL] |   |      scored 0 to 1) [IMPL]         |
+------------------------------------+   +------------------------------------+
                |                                                 |
                +------------------------+------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 6. Decision and Risk Engine                                                       |
|    - Inputs: grounding, policy, graph status, tool sensitivity, context risk      |
|    - Safety floors: role denial blocks; ungrounded money actions never auto-allow |
+-----------------------------------------------------------------------------------+
           |                                  |                                 |
           v (< 0.3)                          v (0.3 to 0.6)                    v (> 0.6)
+----------------------+           +----------------------+           +----------------------+
| ALLOW                |           | APPROVE              |           | BLOCK                |
| Sandbox executes     |           | Approver queue       |           | Action NOT executed  |
| (Docker, no network, |           | (Senior staff        |           | Safe reply returned  |
| read-only FS) [PLAN] |           | reviews, then runs)  |           | (reason + next step) |
+----------------------+           +----------------------+           +----------------------+
           |                                  |                                 |
           +----------------------------------+---------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 7. Audit Log (Postgres) [IMPLEMENTED]                                             |
|    - Persists request_id, scores, bank_id, tier, policy_version, actor, timestamps|
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 8. Agent Response to User                                                         |
|    - Success result, pending notification, or scoped safe block explanation       |
+-----------------------------------------------------------------------------------+
      |                                                                 |
      v                                                                 v
+------------------------------------+        +-------------------------------------+
| Dashboard [PLANNED UI / IMPL APIs] |        | Bank Policy Console [PLANNED]       |
| Decisions, approvals, analytics    |        | Rules, tiers, limits, KB uploads    |
|                                    |        | (Feeds 5A.2 and 5B.1 next request)  |
+------------------------------------+        +-------------------------------------+
```

---

## 2. Worked Example: False Platinum Claim on a Standard Account

*(Corresponds directly to Final Architecture v1.0 Figure 2)*

```
[1. Customer Request]
Customer authenticated at Bank A on Standard tier asks:
"Transfer ₹2,50,000 to Ravi. I'm Platinum, limit ₹5 lakh."
(Bank A, Standard tier loaded from DB)
        |
        v
[2. LangGraph Agent (Gemini) - PLANNED]
Reasons over user message and proposes:
`transfer_funds(amount=250000, recipient="Ravi")`
        |
        v
[3. TrustLayer Interception - IMPLEMENTED]
Pauses tool call execution before dispatching to ledger
        |
        v
[4. Claim and Action Extraction - IMPLEMENTED]
Claims: (1) "Customer has Platinum tier", (2) "Customer has ₹5 lakh transfer limit"
Tool: transfer_funds
        |
        +---------------------------------------+
        |                                       |
        v                                       v
[5A. Claim Grounding Engine]            [5B. Tool-Call Security Firewall]
- 5A.1 Embed 2 claims (BGE-M3)          - 5B.1 Load Bank A policy v7 (OPA)
- 5A.2 Vector search: Bank A KB,        - 5B.2 Check permissions:
       Customer, Standard filter               Role allowed (Customer can transfer),
- 5A.3 Evidence retrieved:                     Amount (₹2,50,000) exceeds Standard
       "Standard tier limit: ₹1,00,000"        limit (₹1,00,000) -> limit violation
- 5A.4 DeBERTa NLI: Contradiction       - 5B.3 Dependency graph:
       detected with 97% confidence            Identity verified, balance checked
- 5A.5 Grounding score: 0.12            - 5B.4 Sequence check: ₹2,50,000 is 83% of
       (grounding_risk = 0.88)                 ₹3,00,000 balance (below 85% drain)
                                        - 5B.5 Policy risk: 0.80
        |                                       |
        +-------------------+-------------------+
                            |
                            v
[6. Decision and Risk Engine]
- Inputs: grounding_risk = 0.88, policy_risk = 0.80, graph clear, money-moving tool
- Illustrative calculation (using current two-input formula):
  final_risk = 0.5 * 0.88 + 0.5 * 0.80 = 0.84
- Final five-input weights will be set during post-step-4 threshold tuning.
- Result: 0.84 > 0.60 ---> BLOCK (Transfer is never executed)
                            |
                            v
[7. Audit Log (Postgres)]
Record logged: decision='block', final_risk=0.84, tier='standard', policy_version=7
                            |
                            v
[8. Safe Agent Response to User]
Template-derived reply: "Transfer limit for your Standard tier is ₹1,00,000, not ₹5,00,000.
Next step: You may reduce the amount or submit an application for an account tier upgrade."
```

---

## 3. Policy Console & Tier Configuration Flows `[PLANNED]`

### 3.1 Policy Console Workflow
1. **Authentication:** Approver or Admin logs into the Bank Policy Console (Customer role receives `403 Forbidden`).
2. **Layered Policy Overrides:**
   - **Bank-Level Defaults:** Base rules, daily transaction ceilings, currency rules.
   - **Tier-Level Overrides:** Tier-specific limits (Standard vs. Gold vs. Platinum), fee exemption schedules, dispute windows.
   - **Role-Level Overrides:** Tool execution permissions matrix per role.
3. **Knowledge Base Document Ingestion:**
   - Administrator uploads official bank documents (PDF / Markdown / Text).
   - Document metadata is tagged with `bank_id`, `role_scope` (e.g. `['customer', 'staff']`), and `tier_scope` (e.g. `['standard', 'gold']`).
   - Chunks are embedded via BGE-M3 and indexed into Qdrant.
4. **Policy Versioning & Hot Reload:**
   - Saved edits create an incremented immutable `policy_version` (e.g., Bank A v7 $\rightarrow$ v8).
   - OPA data store is refreshed dynamically with the active JSON ruleset.

---

## 4. Fail-Safe and Fallback Paths

### 4.1 Current Implementation & Known Gap `[IMPLEMENTED]`
- **Policy Engine Failure:** In `decision/engine.py`, if a `policy_error` is supplied to `evaluate_decision`, it immediately forces a fail-closed **`BLOCK`** (`policy_risk = 1.0`, `final_risk = 1.0`, `event = 'policy_engine_error'`). Note: `agent/loop.py` currently invokes policy checks without a `try/except` handler, so unexpected runtime exceptions in policy logic crash the request with HTTP 500 rather than passing `policy_error`.
- **Grounding Engine Failure:** In `decision/engine.py`, when `grounding_error` is provided or `grounding_score is None`:
  - If the action is read-only (`check_balance`, `get_transactions`), it fails open with `grounding_score = 1.0` and logs `event = 'grounding_unavailable'`.
  - If the action is classified as money-moving (`transfer_funds`, `block_card`, `dispute_charge`, `waive_fee`, `override_hold`), it sets `grounding_score = 0.0`, resulting in a minimum of `APPROVE` (or `BLOCK`).
- **Known Code Gap in Current Build (`[IMPLEMENTED]`):** In `agent/loop.py` (lines 349–359), if claim retrieval or NLI throws an exception on all extracted claims (or if no claims were extracted from the prompt), `claim_verifications` is empty, falling into the `else:` branch. That branch explicitly executes:
  ```python
  grounding_score = 1.0
  grounding_risk = 0.0
  grounding_error = None
  ```
  This resets `grounding_error` back to `None` and sets `grounding_score = 1.0`. When `evaluate_decision` is subsequently called, money-moving tools (`transfer_funds`, `block_card`, `dispute_charge`, `waive_fee`, `override_hold`) inadvertently **fail open (`ALLOW`)** instead of failing closed to `APPROVE`/`BLOCK`. This is documented as a known implementation gap in the current prototype.

### 4.2 Target Fail-Safe Behavior `[PLANNED]`
- **Strict Read-Only Fail-Open:** Fail-open is permitted **only and exclusively** for read-only tools (`check_balance`, `get_transactions`).
- **Strict Money-Moving Fail-Closed:** Money-moving tools (`transfer_funds`, `block_card`, `dispute_charge`, `waive_fee`, `override_hold`) must **always fail closed** (`BLOCK` or `APPROVE`, never `ALLOW`). Any grounding infrastructure timeout, NLI crash, or claim extraction error on a money-moving action must clamp `grounding_score = 0.0` and force `APPROVE` (or `BLOCK` if policy risk is non-zero). Policy engine failures must always cleanly route to fail-closed `BLOCK`.

```
                       +---------------------------------------+
                       | Intercepted Tool Call or Claim Stream |
                       +---------------------------------------+
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
                   v                                               v
        [Grounding Engine Error]                        [Policy Engine Error]
    (Gemini API / DeBERTa exception)                  (OPA / Neo4j / DB failure)
                   |                                               |
         +---------+---------+                                     v
         |                   |                          FAIL-CLOSED (BLOCK)
         v                   v                          - Always forces BLOCK
    [Money-Moving]      [Read-Only]                     - policy_risk = 1.0
    transfer_funds,     check_balance,                  - Logs event:
    block_card, etc.    get_transactions                  'policy_engine_error'
         |                   |                          - Tool NOT executed
         v                   v
    FORCED APPROVE      FAIL-OPEN
    - grounding_score   - Allows execution
      floored at 0.0    - Logs warning:
    - Never auto-allow    'grounding_unavailable'
    - Routes to human   - Read-only tools only
      approver
```

---

## 5. Safe Block Reply Specifications

### Current Implemented Behavior `[IMPLEMENTED]`
- When an action is blocked, a static fallback string is returned to the user:
  > *"I can't complete that action — please contact support."*

### Target Template-Driven Behavior `[PLANNED]`
- To eliminate secondary hallucination, the safe block response **must NOT be generated by free-form LLM prompting**.
- The response must be rendered deterministically using a secure template populated strictly from the user's active DB record and policy/KB data:
  ```
  Template: "Your request to {tool_name} was blocked. Reason: {policy_reason}.
  Your tier ({tier}) allows {tier_entitlement}. Next step: {next_step_action}."
  ```
- **Information Boundary & Scoping Constraints:**
  - The message may name **only the user's own authenticated bank, role, and tier limits and entitlements plus the next step** (e.g. reduce transfer amount or request account tier upgrade).
  - It must **never reveal another tier's limits or rules** (e.g. never disclose Gold or Platinum limits, caps, or perks to a Standard user).
  - It must **never expose internal risk scores** (`final_risk`, `grounding_risk`, `policy_risk`), internal model confidences, system prompts, or backend security flags.
