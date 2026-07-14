# PRSentinel Integration Assessment & Missing Features Matrix (`integration_2.md`)

This document presents the comprehensive architectural and integration audit of **PRSentinel** (`/home/kira/codes/projects/pr-sentinel`), evaluating the live codebase against `Architecture.md` and `integration.md`. 

While core MongoDB schemas (`RiskAnalysis`, `Sprint`, `ActionItem`, `PROutcome`), Winston structured logging (`logger.js`), and baseline GitHub sync/risk pipelines (`syncGitHub.js`, `riskQueue.js`) are functional, several critical security mechanisms, AI sidecar analyzers, graph intelligence features, and frontend visualizations remain **missing or partially implemented**.

Below is the exhaustive audit status table followed by the missing features **ranked by importance** (Tier 1 to Tier 3) with implementation prescriptions.

---

## 1. Executive Integration Status Summary

| Section | Feature Item | Status | Current Codebase Finding |
| :--- | :--- | :---: | :--- |
| **1. Infrastructure** | **Redis Queue Workers** | 🟡 **PARTIAL** | `riskQueue.js` processes risk scores when Redis is active (with inline fallback). However, `webhookQueue.js` is explicitly stubbed out (`logger.warn('Redis queue is disabled...')`), dropping GitHub webhooks from async processing. |
| | **Joi/Zod Schema Validation** | 🔴 **NOT INTEGRATED** | Neither `zod` nor `joi` is installed (`package.json`). Express routes (`webhooks.js`, `jira.js`, `autoAssign.js`) directly destructure `req.body` and `req.params` without runtime schema verification. |
| | **Structured Logging** | 🟢 **INTEGRATED** | `backend/config/logger.js` implements a Winston logger with JSON formatting, timestamps, and console colorization. |
| | **Audit Logging Service** | 🔴 **NOT INTEGRATED** | No `AuditLog.js` model exists in `backend/models`. Sensitive actions (PAT encryption updates, manual sync triggers, AI overrides) are only written to Winston terminal logs, not persisted for compliance. |
| **2. Security** | **Secure Token Storage** | 🟡 **PARTIAL** | GitHub PATs are encrypted using `cryptr` in `User.js` (though default fallback keys exist). **Auth JWTs are stored insecurely in `localStorage`** (`frontend/src/store/index.ts`, `frontend/src/lib/api.ts`) rather than `HttpOnly` Secure cookies. |
| | **React Error Boundaries** | 🔴 **NOT INTEGRATED** | Zero `ErrorBoundary` components or `componentDidCatch` lifecycle wrappers exist across `frontend/src/`. A component render error will crash the entire React DOM tree. |
| | **Data Retention (TTL)** | 🔴 **NOT INTEGRATED** | `backend/models/PREvent.js` defines compound indexes for query speed (`{ prId: 1, occurredAt: 1 }`), but lacks MongoDB `expireAfterSeconds` TTL indexes or background cron cleanup jobs. |
| | **Jira Hardening** | 🔴 **NOT INTEGRATED** | `backend/routes/jira.js` links PRs using `title: { $regex: issueKey, $options: 'i' }` without escaping `issueKey`, creating regex injection vulnerabilities and substring mismatches (`PROJ-1` in `PROJ-12`). Token rotation is absent. |
| **3. Data Models** | **RiskAnalysis Model** | 🟢 **INTEGRATED** | `backend/models/RiskAnalysis.js` completely implements scores, `radar`, `blastRadius`, `staticMetrics`, and `diffAnnotations`. |
| | **PROutcome Model** | 🟢 **INTEGRATED** | `backend/models/PROutcome.js` is implemented (`SAFE`, `REGRESSION`, `PREVENTED`). |
| | **Sprint & ActionItem Models** | 🟢 **INTEGRATED** | `backend/models/Sprint.js` and `backend/models/ActionItem.js` are fully implemented with longitudinal tracking and metrics snapshots. |
| **4. AI Engine** | **Python Sidecar Service** | 🟡 **PARTIAL** | `backend/main.py` runs a FastAPI service calculating cyclomatic complexity via `radon`. However, AST security scanning (`bandit`) and pattern matching (`semgrep`) are neither installed (`requirements.txt`) nor executed. |
| | **Gemini Structured Output** | 🟡 **PARTIAL** | `backend/main.py` uses `response_schema` (`_gemini_response_schema()`) with `gemini-2.0-flash`. Conversely, Node.js backend routes (`backend/routes/ai.js`) call `generateContent` asking for JSON strings and manually parse raw markdown/text without enforced JSON schemas. |
| | **Risk-Based Routing** | 🔴 **NOT INTEGRATED** | `backend/routes/autoAssign.js` sorts eligible candidates strictly by `reviewerLoadIndex: 1, totalReviewsThisWeek: 1` (`contributors[0]`). It does not evaluate `pr.riskScore`, domain expertise, or Gemini AI reviewer recommendations (`Architecture.md` §10.3). |
| **5. Graph & Heatmaps**| **Neo4j Integration** | 🔴 **NOT INTEGRATED** | `docker-compose.yml` configures `neo4j:5-community`, but `neo4j-driver` is not installed in Node.js (`package.json`) and no Neo4j connection, schema, or query logic exists in `backend/`. |
| | **Dependency Ingestion** | 🔴 **NOT INTEGRATED** | No diff parser extracts AST import/require dependencies to populate Neo4j during GitHub sync or webhook ingestion. |
| | **Blast Radius Visualization** | 🔴 **NOT INTEGRATED** | `frontend/src/pages/PRHealthPage.tsx` uses D3.js for a Bubble Matrix, but `frontend/src/pages/PRRiskDetailPage.tsx` does not render a D3 interactive dependency graph for `blastRadius`. |
| | **Unified Heatmap Hub** | 🔴 **NOT INTEGRATED** | `frontend/src/pages/TeamPage.tsx` (`/team`) and `frontend/src/pages/HeatmapPage.tsx` (`/heatmap`) remain separate routes (`App.tsx`) instead of a unified tabbed interface. |
| **6. Real-Time Socket** | **Live Notification Badges** | 🟡 **PARTIAL** | `TopBar.tsx` displays unread counts from `notifStore`, and `useSocket.ts` listens for `'notification:new'`, but routes like `autoAssign.js` emit `'notification'` (`io.to(...).emit('notification', ...)`), causing real-time alerts to be dropped due to event name mismatch. |
| | **Active PR Polling/Push** | 🟡 **PARTIAL** | `socket/index.js` emits `'pr:updated'` and `'metrics:updated'`. `useSocket.ts` invalidates `['prs']` and `['bubble-matrix']`, but does not invalidate `['dashboard']` when `pr:updated` arrives. |

---

## 2. Missing & Incomplete Features — Ranked by Importance

The following features from `Architecture.md` and `integration.md` are ranked by priority. Implementation order should strictly follow Tier 1 $\rightarrow$ Tier 2 $\rightarrow$ Tier 3.

### 🚨 Tier 1: Security, Stability & Data Vulnerability Blockers (Critical Priority)
*These issues pose immediate security risks (XSS, regex injection), system instability (React crashes), or unbounded database bloat.*

#### 1. Secure JWT Storage (`HttpOnly` Cookies instead of `localStorage`)
* **Impact:** High Security Risk. Currently, `useAuthStore` persists user sessions and tokens directly to `localStorage`, and `api.ts` retrieves `localStorage.getItem('token')`. Any XSS vulnerability anywhere in the frontend allows attackers to exfiltrate JWTs and impersonate org admins.
* **Target Files:** `backend/routes/auth.js`, `frontend/src/lib/api.ts`, `frontend/src/store/index.ts`.
* **Prescription:** Update backend login/register endpoints to set JWT via `res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 86400000 })`. Configure axios (`api.ts`) with `withCredentials: true` and remove `localStorage` token handling from Zustand.

#### 2. Joi/Zod API Request Schema Validation
* **Impact:** High Security & Stability Risk. Express API endpoints (`/api/webhooks/github`, `/api/jira/sync`, `/api/auto-assign/:prId`, `/api/auth/*`) ingest unvalidated request bodies. Malformed payloads or type-confusion attacks can crash handlers or pollute MongoDB queries.
* **Target Files:** `backend/middleware/validate.js` (create new), `backend/routes/*.js`, `backend/package.json`.
* **Prescription:** Install `zod` (`npm install zod`). Create a universal validation middleware (`validate(schema)`) and define strict Zod schemas for all route inputs (e.g., webhook headers/body, Jira credentials, PR mutation parameters).

#### 3. React Global & Component Error Boundaries
* **Impact:** High Stability Risk. A single runtime error in a complex component (e.g., D3 simulation, markdown renderer, or null PR attribute) unmounts the entire React DOM tree, showing a blank white screen to users.
* **Target Files:** `frontend/src/components/ErrorBoundary.tsx` (create new), `frontend/src/App.tsx`, `frontend/src/pages/PRRiskDetailPage.tsx`.
* **Prescription:** Implement a class-based `ErrorBoundary` component with fallback UI (displaying error details and a reload button). Wrap the root `AppLayout` and wrap individual data-heavy views (charts, diff annotations, D3 graphs) separately.

#### 4. Jira Regex Hardening & Token Security
* **Impact:** High Security & Accuracy Risk. In `jira.js` line 113, PR matching uses `title: { $regex: issueKey, $options: 'i' }` without escaping `issueKey`. Special characters (`[`, `*`, `+`) in Jira issue keys can cause ReDoS or syntax crashes, while partial matching (`PROJ-1`) incorrectly links `PROJ-123`.
* **Target Files:** `backend/routes/jira.js`.
* **Prescription:** Escape `issueKey` before regex construction: `const escapedKey = issueKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`. Use word boundary anchors: `new RegExp(\`\\b\${escapedKey}\\b\`, 'i')`. Implement automated token rotation alerts.

#### 5. MongoDB TTL Indexes for `PREvent` Data Retention
* **Impact:** High Scalability & Storage Risk. Every GitHub event (review, comment, commit, check run) creates a `PREvent` document (`prEventSchema`). Without an expiration mechanism, `PREvents` will grow unbounded, degrading MongoDB index performance and storage.
* **Target Files:** `backend/models/PREvent.js`.
* **Prescription:** Add a MongoDB TTL index to automatically purge raw events older than 90 days (while retaining `MetricSnapshot` and `RiskAnalysis` aggregates):
  ```javascript
  prEventSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
  ```

---

### 🛡️ Tier 2: Core Architecture & AI/Graph Intelligence Gaps (High Priority)
*These represent the foundational value proposition of PRSentinel (`Architecture.md`), including Neo4j blast radius calculation, sidecar AST scanning, and risk-based reviewer routing.*

#### 6. Neo4j Graph Database Integration & Driver Setup
* **Impact:** Core Feature Missing. `Architecture.md` specifies Neo4j as the secondary database for computing blast radius across microservices and file dependencies. Currently, `docker-compose.yml` runs Neo4j, but the Node.js backend has no driver or connection pool.
* **Target Files:** `backend/config/neo4j.js` (create new), `backend/package.json`.
* **Prescription:** Install `neo4j-driver`. Create a singleton connection pool wrapper (`backend/config/neo4j.js`) that verifies database connectivity on startup and provides structured Cypher transaction helpers.

#### 7. Real-Time Dependency Ingestion Parser (AST to Neo4j)
* **Impact:** Core Feature Missing. Without ingesting imports/exports from PR diffs into Neo4j (`File` nodes and `IMPORTS` edges), the blast radius (`affectedServiceCount`, `affectedFiles`) in `RiskAnalysis` cannot be dynamically computed from structural relationships.
* **Target Files:** `backend/services/graphIngestion.js` (create new), `backend/scripts/syncGitHub.js`.
* **Prescription:** Build a service that parses git diffs (`+ import ... from ...`, `+ const ... = require(...)`, Python `import ...`) using regex or lightweight AST parsers. Execute Cypher queries during `syncGitHub.js` and webhooks to `MERGE (f:File {path: $path}) MERGE (d:File {path: $dep}) MERGE (f)-[:IMPORTS]->(d)`.

#### 8. Python Sidecar Security Tools (`bandit` & `semgrep`)
* **Impact:** Core AI Pipeline Gap. The Python sidecar (`backend/main.py`) only runs `radon` for cyclomatic complexity. The `vulnerabilityFlags` array in `StaticMetrics` is hardcoded as empty `[]` (`_calculate_static_metrics`), missing crucial static security signals before sending diffs to Gemini.
* **Target Files:** `backend/main.py`, `backend/requirements.txt`.
* **Prescription:** Add `bandit` and `semgrep` to `requirements.txt`. In `_calculate_static_metrics()`, run `bandit -r -f json` (for Python additions) and `semgrep --config=p/ci -f json` via `subprocess.run()`. Parse findings into `VulnerabilityFlag(severity=..., message=..., line=...)`.

#### 9. AI Risk-Based Reviewer Routing (`autoAssign.js`)
* **Impact:** Core Architecture Deficit. `Architecture.md` (§10.3) dictates that PRs with `riskScore >= 6.0` should prioritize senior/domain expert reviewers suggested by Gemini. Currently, `autoAssign.js` completely ignores `pr.riskScore` and assigns whoever sits at `contributors[0]` based purely on workload index.
* **Target Files:** `backend/routes/autoAssign.js`.
* **Prescription:** In `autoAssign.js`, query `RiskAnalysis.findOne({ prId: pr._id })`. If `riskScore >= 6.0` and `recommendedReviewers` exists, filter `Contributor.find(...)` to match recommended usernames first, selecting the lowest-load candidate among the AI-suggested domain experts before falling back to global heuristics.

#### 10. Redis Queue `webhookQueue` Processing Pipeline
* **Impact:** High Reliability & Scaling Risk. Webhook ingestion (`webhooks.js`) calls `enqueueWebhook()`, but `webhookQueue.js` is stubbed with a warning and does not create a BullMQ worker. High-velocity GitHub events block or get lost if Redis queueing isn't functional.
* **Target Files:** `backend/jobs/webhookQueue.js`, `backend/server.js`.
* **Prescription:** Implement a genuine BullMQ worker (`new Worker('github-webhooks', async job => { ... })`) inside `webhookQueue.js` that routes `pull_request`, `pull_request_review`, and `check_run` payloads to incremental sync logic (`upsertPR`, `computeAndSaveSnapshot`).

---

### 🎨 Tier 3: Frontend Visualization, Socket Consistency & Auditability (Medium Priority)
*These features polish the user experience, ensure live data synchronization across pages, and provide enterprise compliance tracking.*

#### 11. D3.js Blast Radius Interactive Graph on PR Detail Page
* **Impact:** Visual UI Completeness. `PRRiskDetailPage.tsx` displays risk rationale, static metrics, and diff annotations, but lacks a visual representation of `blastRadius.affectedFiles` and Neo4j subgraph snapshots.
* **Target Files:** `frontend/src/components/BlastRadiusGraph.tsx` (create new), `frontend/src/pages/PRRiskDetailPage.tsx`.
* **Prescription:** Create a D3.js force-directed graph component (`BlastRadiusGraph.tsx`) that renders the target PR files as central nodes and their imported/dependent files (`blastRadius.affectedFiles`) as linked nodes, color-coded by risk label (`CRITICAL`, `HIGH`, etc.).

#### 12. Socket.io Event Name Consistency & Query Invalidation
* **Impact:** Real-Time UI Bug. `autoAssign.js` (line 99) emits `'notification'`, but `useSocket.ts` (line 86) listens exclusively to `'notification:new'`, meaning auto-assign alerts never appear in the notification badge. Additionally, `'pr:updated'` does not refresh `['dashboard']`.
* **Target Files:** `backend/routes/autoAssign.js`, `frontend/src/hooks/useSocket.ts`.
* **Prescription:** Replace `io.to(...).emit('notification', ...)` in `autoAssign.js` with the standard helper `emitNotification(req.orgId, { ... })` (`socket/index.js`). In `useSocket.ts`, add `queryClient.invalidateQueries({ queryKey: ['dashboard'] })` inside the `pr:updated` event listener.

#### 13. Unified Tabbed `/heatmap` Interface
* **Impact:** UI Alignment with `integration.md`. Currently, `/team` (`TeamPage`) and `/heatmap` (`HeatmapPage`) are separate views in the navigation. Merging them into a single hub reduces clutter and unifies team analytics.
* **Target Files:** `frontend/src/pages/TeamAnalyticsHub.tsx` (create new), `frontend/src/App.tsx`, `frontend/src/components/Sidebar.tsx`.
* **Prescription:** Create `TeamAnalyticsHub.tsx` with top tabs: `[Team Roster & Workload]` (`TeamPage` content) and `[Review Heatmap & Diffusion]` (`HeatmapPage` content). Map `/heatmap` and `/team` to this unified hub in `App.tsx`.

#### 14. Node.js Backend Gemini Structured Output Schema (`responseSchema`) Refactoring
* **Impact:** AI Reliability. `backend/routes/ai.js` (`/api/ai/chat`, `/api/retrospective/generate`) calls `model.generateContent(prompt)` asking for JSON string responses and uses fragile markdown-stripping regex (`prompt.replace(/\`\`\`json/g, '')`) before `JSON.parse()`.
* **Target Files:** `backend/routes/ai.js`.
* **Prescription:** Refactor `genai.getGenerativeModel({ model: GEMINI_FLASH_MODEL })` calls across `ai.js` to include `generationConfig: { responseMimeType: 'application/json', responseSchema: { ... } }` matching the expected JSON schemas for AI chat answers and retrospective summaries.

#### 15. Audit Logging Service (`AuditLog` Model & Action Tracking)
* **Impact:** Enterprise Compliance. Sensitive organization operations (connecting GitHub repos, mutating PAT keys, triggering manual syncs, auto-assigning reviewers, generating sprints) are only logged to stdout via Winston, not stored for historical audit trails.
* **Target Files:** `backend/models/AuditLog.js` (create new), `backend/services/auditService.js` (create new), `backend/routes/*.js`.
* **Prescription:** Create an `AuditLog` Mongoose model (`{ orgId, userId, action, targetId, details, ipAddress, timestamp }`). Create a helper `logAudit(req, action, details)` and invoke it across auth, GitHub sync, Jira sync, and settings modification routes.
