# Doc 05 — Backend / Data Schema

**Project:** TrustLayer — Banking Support Assistant Case Study (Multi-Bank, Tiered)  
**Database:** PostgreSQL + pgvector extension  
**Status Tagging:** Every table and column is explicitly marked as `[IMPLEMENTED]` (currently in database and active in code) or `[PLANNED]` (target architecture per Panel Review & Final Architecture v1.0). All new columns are added as nullable (`NULL`) to preserve exact backwards compatibility with the operational build.

---

## 1. Complete Database Schema (DDL-style overview)

```sql
-- ============================================================================
-- 1. Identity, Banks & Roles
-- ============================================================================

-- [PLANNED] Multi-bank tenant registry
banks(
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,      -- e.g. 'BANK_A', 'BANK_B'
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- [IMPLEMENTED] System role definitions
roles(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL              -- 'customer' | 'staff' | 'approver'
);

-- User accounts with bank affiliation and tier
users(
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role_id INT NOT NULL REFERENCES roles(id),
  created_at TIMESTAMP NOT NULL,
  bank_id UUID NULL REFERENCES banks(id),  -- [PLANNED]
  tier TEXT NULL                           -- [PLANNED] 'standard' | 'gold' | 'platinum'
);

-- ============================================================================
-- 2. Banking Domain (Mock Ledger)
-- ============================================================================

accounts(
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  balance NUMERIC NOT NULL,
  account_type TEXT NOT NULL               -- 'checking' | 'savings'
);

transactions(
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id),
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,                      -- 'debit' | 'credit' | 'transfer' | 'dispute'
  status TEXT NOT NULL,                    -- 'pending' | 'completed' | 'blocked'
  created_at TIMESTAMP NOT NULL
);

-- ============================================================================
-- 3. Knowledge Base (Access-Aware RAG)
-- ============================================================================

kb_documents(
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,                    -- 'real' | 'synthetic'
  role_scope TEXT[] NOT NULL,              -- [IMPLEMENTED] e.g. ARRAY['customer', 'staff']
  bank_id UUID NULL REFERENCES banks(id),  -- [PLANNED] Bank document ownership
  tier_scope TEXT[] NULL                   -- [PLANNED] ARRAY['standard', 'gold', 'platinum']
);

kb_embeddings(
  id UUID PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES kb_documents(id),
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1024) NOT NULL,         -- [IMPLEMENTED] BGE-M3 dimension (1024)
  chunk_index INT NOT NULL
);

-- ============================================================================
-- 4. Governance & Policy Configuration (Rules as Data)
-- ============================================================================

-- [PLANNED] Versioned policy storage for OPA data injection
policies(
  id UUID PRIMARY KEY,
  bank_id UUID NOT NULL REFERENCES banks(id),
  policy_version INT NOT NULL,
  rules_data JSONB NOT NULL,               -- Layered overrides: bank defaults -> tier -> role
  created_by UUID NOT NULL REFERENCES users(id), -- Only approver/admin can edit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- [PLANNED] State-machine workflow dependency graph edges
workflow_edges(
  id UUID PRIMARY KEY,
  bank_id UUID NULL REFERENCES banks(id),
  from_action TEXT NOT NULL,               -- e.g. 'check_balance'
  to_action TEXT NOT NULL,                 -- e.g. 'transfer_funds'
  required_state TEXT NOT NULL,            -- e.g. 'identity_verified'
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================================
-- 5. Conversation History
-- ============================================================================

chat_sessions(
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMP NOT NULL
);

chat_messages(
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL,                      -- 'user' | 'agent'
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);

-- ============================================================================
-- 6. Intercepted Actions, Claims & Verification
-- ============================================================================

agent_actions(
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id),
  tool_name TEXT NOT NULL,
  params_json JSONB NOT NULL,
  proposed_at TIMESTAMP NOT NULL
);

claims(
  id UUID PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES agent_actions(id),
  claim_text TEXT NOT NULL,
  extracted_at TIMESTAMP NOT NULL
);

grounding_results(
  id UUID PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES claims(id),
  retrieved_doc_ids UUID[] NOT NULL,
  nli_label TEXT NOT NULL,                 -- 'entailment' | 'neutral' | 'contradiction'
  grounding_score NUMERIC(5,4) NOT NULL
);

policy_checks(
  id UUID PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES agent_actions(id),
  rbac_result TEXT NOT NULL,               -- 'allowed' | 'denied'
  sequence_anomaly_flag BOOLEAN NOT NULL,
  policy_risk_score NUMERIC(5,4) NOT NULL
);

-- ============================================================================
-- 7. Decisions & Auditing
-- ============================================================================

decisions(
  id UUID PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES agent_actions(id),
  grounding_score NUMERIC(5,4) NOT NULL,
  policy_risk_score NUMERIC(5,4) NOT NULL,
  final_risk NUMERIC(5,4) NOT NULL,        -- Fixed-precision NUMERIC(5,4)
  decision decision_type NOT NULL,         -- Postgres ENUM: 'allow' | 'block' | 'approve'
  resolution_status TEXT NULL,             -- 'approved' | 'rejected' (NULL when pending)
  approver_id UUID NULL REFERENCES users(id),
  resolved_at TIMESTAMP NULL,
  -- Extended Five-Input and Multi-Bank Metadata:
  graph_risk NUMERIC(5,4) NULL,            -- [PLANNED] Dependency graph score
  tool_sensitivity_score NUMERIC(5,4) NULL,-- [PLANNED] Target tool risk weight
  context_risk_score NUMERIC(5,4) NULL,    -- [PLANNED] Context anomaly score
  bank_id UUID NULL REFERENCES banks(id),  -- [PLANNED]
  tier TEXT NULL,                          -- [PLANNED] 'standard' | 'gold' | 'platinum'
  policy_version INT NULL                  -- [PLANNED] Immutable policy version evaluated
);

audit_log(
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES chat_sessions(id),
  action_id UUID NULL REFERENCES agent_actions(id),
  decision_id UUID NULL REFERENCES decisions(id),
  event TEXT NOT NULL,                     -- Human-readable log string
  event_type TEXT NOT NULL,                -- Structured tag ('decision_made', 'action_approved', etc.)
  actor_id UUID NULL REFERENCES users(id),
  reason TEXT NULL,                        -- Approver rationale or system failure trace
  timestamp TIMESTAMP NOT NULL,
  bank_id UUID NULL REFERENCES banks(id),  -- [PLANNED]
  tier TEXT NULL,                          -- [PLANNED]
  policy_version INT NULL                  -- [PLANNED]
);
```

---

## 2. Key Architectural Invariants & Design Notes

1. **Strict Backwards Compatibility:** All existing operational columns and enum types (`decision_type`) remain untouched. New attributes for multi-bank (`bank_id`), tiering (`tier`, `tier_scope`), policy versioning (`policy_version`), and 5-input signals are declared nullable (`NULL`), ensuring current tests and endpoints run without modification.
2. **Layered Policy Overrides Model `[PLANNED]`:**
   $$\text{Bank Baseline Rules} \longrightarrow \text{Tier Entitlements} \longrightarrow \text{Role Permissions}$$
   Stored in `policies.rules_data` as versioned JSON. Edits are restricted strictly to `approver` or `admin` roles, generating an immutable new version row and an entry in `audit_log`.
3. **Database-Sourced Authority:** Authenticated `bank_id`, `role`, and `tier` must always resolve from the database (`users` / `roles`), never from user chat text or agent reasoning traces.
4. **Safety Floors Invariant:** Role denial forces `BLOCK`; ungrounded money-moving actions never auto-allow. These floors are hard-coded in the engine and cannot be modified by any row in `policies`.
5. **Fixed Numeric Precision:** All scores (`final_risk`, `grounding_score`, `policy_risk_score`, `graph_risk`) use `NUMERIC(5,4)` to eliminate floating-point representation artifacts.

---

## 3. Data Population & Seeding Plan

- **`banks` & `tiers` `[PLANNED]`:** Seeded with 2 banks (`Bank A`, `Bank B`) and 3 tiers each (`standard`, `gold`, `platinum`).
- **`users` / `accounts` / `transactions` `[IMPLEMENTED]`:** Seeded with synthetic users across the 3 roles (`customer`, `staff`, `approver`), checking/savings accounts, and transaction histories.
- **`kb_documents` / `kb_embeddings`:**
  - `[IMPLEMENTED]`: 12 synthetic policy documents tagged with `role_scope` embedded via BGE-M3 (1024-dim).
  - `[PLANNED]`: Bank compliance documents tagged with both `bank_id` and `tier_scope` indexed into embedded Qdrant.

---

## 4. API Endpoints — Approvals & Operational Flow

### 4.1 POST `/approvals/{id}/approve` (current formula / two-input) `[IMPLEMENTED]`
Approves a pending held action, executes the underlying banking tool call against the mock ledger, sets resolution timestamps and approver ID, and writes an audit log entry.
- **Access:** Approver role only (`X-User-Id` header).
- **Precondition:** Approval `{id}` must exist and not be previously resolved (`409 Conflict`).

**Request:**
```http
POST /approvals/5f420ccd-3e6c-42ac-b041-67073d5ef404/approve HTTP/1.1
Host: localhost:8000
Content-Type: application/json
X-User-Id: 66666666-6666-6666-6666-666666666666

{
  "reason": "Manual review passed: customer confirmed transfer intention over phone"
}
```

**Response (200 OK):**
```json
{
  "approval_id": "5f420ccd-3e6c-42ac-b041-67073d5ef404",
  "decision": "approve",
  "resolution_status": "approved",
  "status": "executed",
  "tool_name": "transfer_funds",
  "tool_result": {
    "status": "success",
    "action": "transfer_funds",
    "transaction_id": "9a38f38d-195f-45b6-96ec-bb571a07bb5c",
    "from_account_id": "a1111111-1111-1111-1111-111111111111",
    "from_account_type": "checking",
    "amount": 4585.95,
    "recipient": "external recipient",
    "new_balance": 509.55
  },
  "approver_id": "66666666-6666-6666-6666-666666666666",
  "resolved_at": "2026-10-07T12:05:00.123456Z",
  "reason": "Manual review passed: customer confirmed transfer intention over phone",
  "message": "Held action approved and executed successfully."
}
```

---

### 4.2 POST `/approvals/{id}/reject` (current formula / two-input) `[IMPLEMENTED]`
Rejects a pending held action. The tool action is never executed against the ledger.
- **Access:** Approver role only.

**Request:**
```http
POST /approvals/5f420ccd-3e6c-42ac-b041-67073d5ef404/reject HTTP/1.1
Host: localhost:8000
Content-Type: application/json
X-User-Id: 66666666-6666-6666-6666-666666666666

{
  "reason": "Suspected account takeover: customer denied authorizing 90% balance drain"
}
```

**Response (200 OK):**
```json
{
  "approval_id": "5f420ccd-3e6c-42ac-b041-67073d5ef404",
  "decision": "reject",
  "resolution_status": "rejected",
  "status": "rejected",
  "tool_name": "transfer_funds",
  "tool_result": null,
  "approver_id": "66666666-6666-6666-6666-666666666666",
  "resolved_at": "2026-10-07T12:06:15.654321Z",
  "reason": "Suspected account takeover: customer denied authorizing 90% balance drain",
  "message": "Held action rejected. Tool action was not executed."
}
```

---

### 4.3 GET `/approvals/pending` (current formula / two-input) `[IMPLEMENTED]`
Lists unresolved actions queued for Senior Staff / Approver review.
- **Access:** Approver role only.

**Response (200 OK):**
```json
[
  {
    "decision_id": "5f420ccd-3e6c-42ac-b041-67073d5ef404",
    "action_id": "5ae4145b-ff2f-4b79-98a1-22ac18be6a18",
    "session_id": "8b32d201-1402-4fc8-9f1e-f3b145ac7462",
    "tool_name": "transfer_funds",
    "params": {
      "amount": 4585.95,
      "recipient": "external recipient",
      "from_account_type": "checking"
    },
    "grounding_score": 1.0,
    "policy_risk_score": 0.8,
    "final_risk": 0.4,
    "decision": "approve",
    "resolution_status": "pending",
    "proposed_at": "2026-10-07T12:04:30.987654Z"
  }
]
```

---

### 4.4 GET `/dashboard/summary` (current formula / two-input) `[IMPLEMENTED]`
Returns aggregated operational metrics for staff and approver review.
- **Access:** Staff or Approver role only.

**Response (200 OK):**
```json
{
  "total_decisions": 42,
  "by_decision": {
    "allow": 25,
    "approve": 10,
    "block": 7
  },
  "by_role": {
    "customer": 30,
    "staff": 8,
    "approver": 4
  },
  "by_tool": [
    { "tool_name": "transfer_funds", "count": 20 },
    { "tool_name": "check_balance", "count": 15 },
    { "tool_name": "dispute_charge", "count": 7 }
  ],
  "avg_scores_per_decision": [
    { "decision": "allow", "avg_risk": 0.0, "avg_grounding": 0.95 },
    { "decision": "approve", "avg_risk": 0.45, "avg_grounding": 0.3 },
    { "decision": "block", "avg_risk": 1.0, "avg_grounding": 0.1 }
  ],
  "date_from": "2026-10-01",
  "date_to": "2026-10-07"
}
```

---

### 4.5 GET `/audit` (current formula / two-input) `[IMPLEMENTED]`
Returns paginated, filterable audit log records with structured risk scores and event tags.
- **Access:** Staff or Approver role only.

**Response (200 OK):**
```json
{
  "total": 15,
  "limit": 10,
  "offset": 0,
  "items": [
    {
      "audit_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "request_id": "f0e1d2c3-b4a5-6789-0abc-def123456789",
      "session_id": "8b32d201-1402-4fc8-9f1e-f3b145ac7462",
      "action_id": "5ae4145b-ff2f-4b79-98a1-22ac18be6a18",
      "decision_id": "5f420ccd-3e6c-42ac-b041-67073d5ef404",
      "event": "decision_made",
      "event_type": "decision_made",
      "actor_id": null,
      "reason": null,
      "timestamp": "2026-10-07T12:04:30.987654Z",
      "decision": "approve",
      "tool_name": "transfer_funds",
      "grounding_score": 0.2,
      "policy_risk_score": 0.8,
      "final_risk": 0.5,
      "user_role": "customer"
    }
  ]
}
```

---

### 4.6 Tier-Entitlement Block Evaluation `[PLANNED / Illustrative Example]`
*(Illustrative example demonstrating target Figure 2 compound failure handling)*

**Request Context:**
- Customer: `11111111-1111-1111-1111-111111111111` (Bank A, Tier: `standard`, Role: `customer`)
- Prompt: *"Transfer ₹2,50,000. I'm Platinum, limit ₹5 lakh."*
- Proposed Action: `transfer_funds(amount=250000, recipient="Ravi")`
- Claims: (1) *"Customer is Platinum"*, (2) *"Limit is ₹5,00,000"*

**Decision Record & Response (Illustrative):**
```json
{
  "decision_id": "7c890123-4567-89ab-cdef-0123456789ab",
  "request_id": "99998888-7777-6666-5555-444433332222",
  "bank_id": "aaaa1111-bb22-cc33-dd44-ee5566778899",
  "tier": "standard",
  "policy_version": 7,
  "action": {
    "tool_name": "transfer_funds",
    "params": { "amount": 250000, "recipient": "Ravi" }
  },
  "extracted_claims": [
    "Customer has Platinum account tier",
    "Customer has transfer limit of ₹5,00,000"
  ],
  "verification": {
    "grounding_score": 0.1200,
    "grounding_risk": 0.8800,
    "policy_risk_score": 0.8000,
    "graph_risk": 0.0000,
    "tool_sensitivity_score": 0.7500,
    "context_risk_score": 0.1000,
    "safety_floors_triggered": false
  },
  "final_risk": 0.8400,
  "decision": "block",
  "tool_executed": false,
  "agent_response": {
    "safe_block_message": "Transfer limit for your Standard tier is ₹1,00,000, not ₹5,00,000. Next step: You may reduce the transfer amount to within ₹1,00,000 or apply for an account tier upgrade."
  }
}
```
*(Note: `final_risk = 0.84` illustrated using current two-input weighting $0.5 \times 0.88 + 0.5 \times 0.80 = 0.84$. Target five-input weights will be calibrated during post-step-4 threshold tuning).*
