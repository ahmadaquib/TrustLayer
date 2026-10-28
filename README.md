# TrustLayer

**Access-Aware RAG Gateway & Dual-Grounding Policy Firewall for Financial AI Agents**

TrustLayer intercepts proposed AI agent tool calls before execution, running dual-path verification: claim grounding (RAG + NLI) and role-based policy enforcement (RBAC + sequence anomaly checks).

[![Status](https://img.shields.io/badge/status-active--development-orange.svg)]()
[![Backend](https://img.shields.io/badge/backend-FastAPI%20%7C%20Python%203.11+-blue.svg)]()
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%7C%20TypeScript%20%7C%20Vite-61dafb.svg)]()
[![Database](https://img.shields.io/badge/database-PostgreSQL%20%7C%20pgvector-336791.svg)]()

---

## The Problem

AI agents taking autonomous actions in high-stakes domains (such as banking and financial services) can fail in two distinct ways, which traditional security architectures address in isolation:

1. **Unauthorized Actions (Access Violations):** The agent executes an action forbidden for the authenticated user's role.
2. **Ungrounded Claims (Hallucinations):** The agent acts on a factual assertion that is false or unsupported by authoritative records, even if the action type itself is permitted.

The most dangerous failure is the intersection: **a fully authorized action resting on an ungrounded claim** — such as waiving fees or transferring funds because the agent incorrectly "believed" an exceptional waiver policy applied. Access controls alone cannot detect the hallucination, and standard RAG verification alone cannot enforce role permissions.

---

## What TrustLayer Does

TrustLayer sits between the agent's intent-resolution step and tool execution. For every proposed tool call, it executes dual-path verification and fuses the results into a single deterministic decision:

```
User Request -> FastAPI Gateway -> Agent (Proposes Tool Call)
                                         |
                                TrustLayer Interception
                                /                      \
                    Claim Grounding                 Policy Firewall
           (Extract claims via Gemini,          (Role-based access matrix,
            pgvector role-scoped RAG,            sequence anomaly checks)
            DeBERTa-v3 cross-encoder NLI)                  |
                                \                      /
                                  Risk Fusion Engine
                             ALLOW / BLOCK / APPROVE
                                         |
                         +---------------+---------------+
                         |                               |
                 [ALLOW: Execute]              [APPROVE / BLOCK]
                         |                               |
                 Mock Bank Ledger                 Approver Queue
                         \                               /
                          +--------------+--------------+
                                         |
                                PostgreSQL Audit Log
                             (Request-ID Correlated)
```

1. **Claim Grounding Pipeline:**
   - **Atomic Claim Extraction:** Parses the agent's reasoning into discrete atomic claims using Google Gemini (with heuristic fallback).
   - **Role-Aware Evidence Retrieval:** Queries PostgreSQL using `pgvector` and BGE-M3 1024-dimensional embeddings, filtering strictly to documents visible to the user's role.
   - **NLI Cross-Encoder Verification:** Compares each claim against retrieved evidence using local DeBERTa-v3 (`cross-encoder/nli-deberta-v3-base`) to compute a factual grounding score.

2. **Policy Enforcement Firewall:**
   - **Role-Based Access Control (RBAC):** Validates the caller's role (`customer`, `staff`, `approver`) against tool-level permission rules.
   - **Sequence Anomaly Detection:** Flags dangerous patterns (e.g., checking balance immediately followed by a near-total funds transfer).

3. **Risk Fusion & Fail-Safe Floor:**
   - Combines grounding risk and policy risk into a single verdict:
     - **`ALLOW`**: Low risk; tool executes immediately against the mock ledger.
     - **`APPROVE`**: Moderate risk or high-value action; held in a queue for Senior Approver review.
     - **`BLOCK`**: Violation detected; execution halted and logged.
   - **Fail-Safe Floor:** Money-moving tools (`transfer_funds`, `dispute_charge`, `block_card`) fail closed to `BLOCK` or `APPROVE` if verification raises an error.

4. **Immutable Audit Logging:** Every intercepted request, claim score, policy check, and reviewer decision is logged to PostgreSQL with a unified `request_id`.

---

## Repository Structure

```
TrustLayer/
├── .env.example             # Master environment configuration template
├── .gitignore               # Unified repository git ignore
├── package.json             # Monorepo orchestration scripts (npm start, dev, test)
├── run.bat                  # Windows one-click unified launcher (build + serve)
├── backend/
│   ├── src/trustlayer/
│   │   ├── agent/           # Interception loop & mock banking ledger tools
│   │   │   ├── loop.py      # Primary interception loop & fail-safe handlers
│   │   │   └── tools.py     # Banking actions (transfer, balance, block, dispute)
│   │   ├── api/             # FastAPI REST endpoints
│   │   │   ├── chat.py      # POST /chat conversational gateway
│   │   │   ├── approvals.py # GET /approvals/pending, POST /{id}/approve & reject
│   │   │   └── analytics.py # GET /dashboard/summary & GET /audit
│   │   ├── audit/           # Structured audit logging & DB persistence
│   │   ├── auth/            # Role resolution & dependency guards
│   │   ├── db/              # Async SQLAlchemy models, sessions & seeders
│   │   ├── decision/        # Risk fusion engine & safety floor overrides
│   │   ├── grounding/       # Claim extraction (Gemini), retrieval (pgvector), NLI
│   │   ├── policy/          # RBAC matrix & sequence anomaly rules
│   │   └── main.py          # FastAPI entrypoint, CORS & static SPA mounting
│   ├── eval/                # 97-case benchmark suite and ablation runner
│   │   ├── run_eval.py      # Benchmark evaluation runner
│   │   └── cases.json       # Test cases with ground truth labels
│   ├── pyproject.toml       # Python dependencies managed via uv
│   ├── uv.lock              # Backend dependency lockfile
│   └── alembic.ini          # Schema migrations configuration
├── frontend/
│   ├── src/
│   │   ├── api/             # Strongly-typed HTTP client for backend endpoints
│   │   ├── components/      # Reusable view components
│   │   │   ├── approval/    # ApproverQueueView (queue & inspection drawer)
│   │   │   ├── chat/        # ChatView (chat stream & inline decision badges)
│   │   │   ├── dashboard/   # AnalyticsDashboardView (KPIs & audit table)
│   │   │   └── Header.tsx   # Top navigation, role switcher & latency monitor
│   │   ├── routes/          # Role-tailored page views (Customer, Approver, Admin)
│   │   ├── theme/           # Design system tokens (Navy, Blue, Green, Amber, Red)
│   │   ├── types/           # TypeScript interfaces matching backend schemas
│   │   ├── App.tsx          # Application shell & unified role session state
│   │   └── main.tsx         # React 19 entrypoint
│   ├── package.json         # Frontend dependencies and Vite scripts
│   ├── package-lock.json    # Frontend dependency lockfile
│   ├── tsconfig.json        # TypeScript configuration
│   └── vite.config.ts       # Vite config with backend API reverse proxy
└── docs/                    # Technical specifications, architecture, and threat model
```

---

## Frontend Dashboard Views & Design System

The frontend provides a role-aware interface reflecting the user's active permissions:

1. **Customer Chat Interface (`/customer`):**
   - Interactive conversational banking assistant intercepted in real-time.
   - Inline decision badges reflecting policy outcomes:
     - `[Action Completed: ...]` (Green for `ALLOW`)
     - `[Under Review: Pending Senior Staff Approval]` (Amber for `APPROVE`)
     - `[Action Blocked: Security / Policy Restriction]` (Red for `BLOCK`)
   - Pre-configured prompt chips for rapid testing (benign requests, sequence anomalies, ungrounded claims).

2. **Approver Queue Interface (`/approver`):**
   - Real-time queue of held high-risk decisions awaiting Senior Staff review (`GET /approvals/pending`).
   - Deep inspection drawer displaying:
     - Proposed tool call and argument payload.
     - Multi-source risk breakdown bars: Grounding Score, Policy Risk, Combined Final Risk.
   - One-click Approve / Reject actions with reviewer justification input and double-action prevention (`409 Conflict` safety).

3. **Executive Audit & Risk Analytics (`/admin`):**
   - KPI metrics cards: Total Requests, % ALLOW, % APPROVE, % BLOCK, and average risk indices.
   - Visual decision ratio distribution bar and breakdowns by role and tool.
   - Paginated, filterable audit log table (`GET /audit`) with live filtering by Decision, Tool, and Role.

4. **Global Navigation & Session Control:**
   - Instant demo role switcher: Alice Johnson (Customer), Bob Smith (Customer), Sarah Davis (Staff), Eleanor Vance (Approver).
   - Real-time heartbeat indicator polling `/health` displaying live round-trip API latency.

5. **Design System Tokens:**
   - Dark navy palette: Background `#0B192C`, Card `#1E3E62`, Accent `#FF6500`.
   - Semantic status colors: Green `#10B981` (ALLOW), Amber `#F59E0B` (APPROVE), Red `#EF4444` (BLOCK).

---

## Tech Stack & Tooling

| Component | Technology | Role |
|---|---|---|
| **Backend Package Manager** | `uv` | High-performance Python package installer & resolver |
| **Backend Runtime** | Python 3.11+ | Asyncio-native execution |
| **API Framework** | FastAPI + Uvicorn | ASGI server with auto-generated OpenAPI documentation |
| **Database** | PostgreSQL + `pgvector` | Async SQLAlchemy 2.0 with Alembic migrations |
| **Embeddings** | BGE-M3 (`BAAI/bge-m3`) | Dense 1024-dim local embeddings |
| **NLI Cross-Encoder** | DeBERTa-v3 (`cross-encoder/nli-deberta-v3-base`) | Local sentence-pair inference for fact checking |
| **Claim Extraction** | Google Gemini API | Structured claim parser with heuristic fallback |
| **Frontend Framework** | React 19 + TypeScript | Type-safe reactive component architecture |
| **Frontend Tooling** | Vite | Ultra-fast bundling, HMR, and development proxy |

---

## Prerequisites

1. **Python 3.11+**
2. **`uv`**: Install via `curl -LsSf https://astral.sh/uv/install.sh` (or `winget install --id=astral-sh.uv` on Windows).
3. **Node.js 18+ (20+ recommended)** and `npm`.
4. **PostgreSQL with `pgvector`**:
   ```bash
   docker run -d --name trustlayer-pg -p 5432:5432 -e POSTGRES_PASSWORD=root1234 pgvector/pgvector:pg16
   ```

---

## Environment Setup

TrustLayer provides a master `.env.example` at the repository root. Create your `.env` file:

```bash
cp .env.example .env
```

Configure the environment variables in `.env`:

```ini
# Database connection string (PostgreSQL + pgvector with asyncpg)
DATABASE_URL=postgresql+asyncpg://postgres:root1234@localhost:5432/trustlayer

# Google Gemini API key (for claim extraction; fallback heuristic active if omitted)
GEMINI_API_KEY=your_gemini_api_key_here

# Hugging Face access token (for downloading BGE-M3 and DeBERTa-v3 models)
HF_TOKEN=your_huggingface_token_here

# Local cache directory for Hugging Face weights (defaults to ./models_cache relative to backend)
HF_HOME=./models_cache

# Frontend API base URL (Vite dev server proxies automatically if omitted)
VITE_API_BASE_URL=http://localhost:8000
```

> **Note on configuration resolution:** The backend automatically inspects both the root `.env` and `backend/.env`.

---

## Initial Setup & Database Initialization

### 1. Install Dependencies

Install backend and frontend dependencies:

```bash
# Backend dependencies
cd backend
uv sync

# Frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 2. Apply Database Migrations & Seed Data

```bash
cd backend

# Run schema migrations
uv run alembic upgrade head

# Seed initial roles, demo users, and mock bank accounts
uv run python -m trustlayer.db.seed

# Seed the access-controlled knowledge base
uv run python -m trustlayer.db.seed_kb

cd ..
```

---

## Starting the Entire Application

TrustLayer supports unified single-command startup. The frontend is built into static assets and served directly by the FastAPI backend at `http://localhost:8000`.

### Option A: Using npm (Cross-Platform)

```bash
npm start
```

### Option B: Using Windows Launcher

```cmd
run.bat
```

### Option C: Concurrent Development Mode (with Hot Reloading)

```bash
npm run dev
```

Once running:
- **Unified Web Dashboard:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check Endpoint:** [http://localhost:8000/health](http://localhost:8000/health)

---

## Running Services Independently

For active development, the backend and frontend can be run in separate terminals:

### Running the Backend Independently

```bash
cd backend
uv run uvicorn trustlayer.main:app --reload --port 8000
```
*Or from root:* `npm run dev:backend`

### Running the Frontend Independently

```bash
cd frontend
npm run dev
```
*Or from root:* `npm run dev:frontend`

The Vite development server runs at [http://localhost:5173](http://localhost:5173) and automatically proxies API requests (`/chat`, `/approvals`, `/dashboard`, `/audit`, `/health`, `/users`) to `http://localhost:8000`.

---

## Core API Endpoints

All endpoints are documented interactively in Swagger at `http://localhost:8000/docs`.

| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `POST` | `/chat` | `X-User-Id` (Customer) | Processes conversational message, executes dual-path checks, returns decision & reply. |
| `GET` | `/approvals/pending` | `X-User-Id` (Approver) | Lists held high-risk decisions awaiting human review. |
| `POST` | `/approvals/{id}/approve` | `X-User-Id` (Approver) | Approves a held action; executes the tool against the mock ledger. |
| `POST` | `/approvals/{id}/reject` | `X-User-Id` (Approver) | Blocks a held action and logs the reviewer justification. |
| `GET` | `/dashboard/summary` | Any | Returns aggregated KPIs, decision distribution, and tool usage metrics. |
| `GET` | `/audit` | Any | Retrieves immutable audit log rows with filtering (`decision`, `tool`, `role`, pagination). |
| `GET` | `/users` | Any | Returns seeded demo users for client-side role switching. |
| `GET` | `/health` | None | Returns service health status and database connectivity. |

---

## Testing & Evaluation

### Backend Regression & Safety Tests

Run backend tests using `uv`:

```bash
cd backend

# Run safety regression tests (fail-closed floor, policy exceptions)
uv run pytest src/trustlayer/test_safety_fixes.py -v

# Run approval workflow tests
uv run pytest src/trustlayer/test_approvals.py -v

# Run analytics and audit tests
uv run pytest src/trustlayer/test_analytics.py -v

# Run entire test suite
uv run pytest -v
```

### Full Monorepo Validation

From the project root:

```bash
npm test
```
Runs both the backend regression test suite and the frontend TypeScript production build.

### Evaluation Benchmark (97 Cases & Ablation Study)

TrustLayer includes a 97-case benchmark assessing decision accuracy across benign and adversarial requests:

```bash
cd backend/eval
uv run python run_eval.py --mode full
```

Available modes:
- `--mode full`: Combined pipeline (Grounding + Policy).
- `--mode rbac_only`: Evaluates decisions with claim grounding disabled.
- `--mode grounding_only`: Evaluates decisions with RBAC policy disabled.
- `--mode all`: Runs full pipeline and all ablations, outputting comparison tables.

Results are written to `backend/eval/results.csv` and `backend/eval/ablation_results.csv`.

---

## Production Build & Static Serving

The React frontend compiles into an optimized Single-Page Application (SPA):

```bash
cd frontend
npm run build
```

The resulting assets in `frontend/dist/` are automatically mounted by FastAPI in `backend/src/trustlayer/main.py`:
- `GET /` serves `frontend/dist/index.html`.
- Static assets (`/assets/*`) are served directly.
- Client-side routes (`/customer`, `/approver`, `/admin`) fall back to `index.html`.

---

## Troubleshooting & Common Workflows

- **Model Downloads on First Run:**
  On the first run with claim grounding enabled, Hugging Face models (BGE-M3 and DeBERTa-v3, ~3GB total) download to `backend/models_cache/`. Ensure adequate disk space and internet access.
- **Offline / Missing Gemini API Key:**
  If `GEMINI_API_KEY` is not provided, the claim extractor switches to regex-based heuristic parsing.
- **Approval Double-Action Prevention:**
  Attempting to approve or reject an already-resolved action returns `409 Conflict` to prevent duplicate ledger transactions.
- **Port Conflicts:**
  If port 8000 is occupied, supply `--port <new_port>` to Uvicorn and update `VITE_API_BASE_URL` in `.env`.
- **Database Connection Failure:**
  Ensure PostgreSQL is running (`docker ps`) and `DATABASE_URL` matches your local credentials.

---

## Project Status & Roadmap

- [x] Dual-grounding claim extraction (Gemini) + BGE-M3 role-aware RAG + DeBERTa-v3 NLI
- [x] RBAC policy engine and sequence anomaly detection
- [x] Risk fusion decision engine (`ALLOW` / `BLOCK` / `APPROVE`) with fail-closed safety floor
- [x] Immutable PostgreSQL audit log with request-ID correlation
- [x] Interception loop with mock banking ledger tools
- [x] Unified React 19 dashboard (Customer Chat, Approver Queue, Risk Analytics)
- [x] Unified single-command launcher and static SPA mounting in FastAPI
- [ ] 97-case evaluation benchmark report write-up
- [ ] LangGraph agent migration

---

## Documentation

Comprehensive design specifications and architectural requirements are available in [`docs/`](docs/):
- [`docs/01_PRD_Product_Requirements_Document.md`](docs/01_PRD_Product_Requirements_Document.md)
- [`docs/02_TRD_Technical_Requirements_Document.md`](docs/02_TRD_Technical_Requirements_Document.md)
- [`docs/03_App_Request_Flow.md`](docs/03_App_Request_Flow.md)
- [`docs/04_Threat_Model_and_Evaluation_Plan.md`](docs/04_Threat_Model_and_Evaluation_Plan.md)
- [`docs/05_Database_Schema_and_Entity_Relationship.md`](docs/05_Database_Schema_and_Entity_Relationship.md)
