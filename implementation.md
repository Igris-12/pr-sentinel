# PRSentinel — Comprehensive Architecture & Working System Manual
## Technical Build Knowledge, Module Mechanics & Operational Data Flows

This document serves as the comprehensive engineering manual for the **PRSentinel** capstone team. It is designed to give every team member complete clarity on how our platform operates end-to-end, why specific architectural and Agile build decisions were made, and how each module processes data in a real-world engineering environment. 

Rather than focusing on isolated code syntax or defensive trivia, this manual details the **working use cases, operational workflows, and structural relationships** across our three-tier system. Presenters can use this guide to confidently explain the engineering principles and practical workings behind our platform during demonstrations and project evaluations.

---

## 1. System Overview & Build Methodology

Modern software engineering teams at scale often suffer from fragmented tooling: code review happens inside GitHub pull requests, task tracking happens in Jira or backlog boards, and sprint retrospectives rely on subjective memory or vanity metrics like story points. 

Our Agile capstone team built **PRSentinel** as a unified **Engineering Intelligence Platform** designed to solve these exact friction points by operating at two complementary levels simultaneously:
1. **The Retrospective Telemetry Layer:** Continuously ingests pull request events to compute behavioral metrics (cycle times, review latency, code churn, and stagnation probability), storing them as time-series snapshots to track team velocity and review capacity over time.
2. **The Proactive Risk Prevention Layer:** Intercepts code modifications at the pull request creation stage, combining deterministic static complexity metrics (`radon`) with structured generative AI (`Gemini 2.0 Flash`) to score diff risk, flag vulnerabilities, and automate reviewer routing directly inside GitHub before code merges.

### Three-Tier Microservice Architecture
To build a system that can handle real-time webhook ingestion while executing heavy mathematical and LLM computations without freezing the user interface or server event loops, we structured PRSentinel across three distinct runtime environments:

```
┌─────────────────────────────────────────────────────────────────────────┐
│               FRONTEND (React 19 + TypeScript + Vite)                   │
│  • UI Design System: Glassmorphic Tailwind CSS                          │
│  • State & Cache: Zustand (Client State) + TanStack React Query v5     │
│  • Interactive Analytics: Recharts (Trends) + D3.js v7 (Physics/Graphs) │
│  • Real-Time Gateway: Socket.IO Client v4.8                             │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↕ HTTP / WebSocket
┌─────────────────────────────────────────────────────────────────────────┐
│           PRIMARY BACKEND API (Node.js 22 / Express + Socket.IO)        │
│  • API Gateway: /auth, /github, /metrics, /prs, /risk, /ai, /heatmap,  │
│                 /scorecard, /jira, /auto-assign, /retrospective, /webhooks│
│  • Decoupled Queueing: BullMQ v5 / Redis (with inline execution fallback) │
│  • GitHub Automation: Octokit v21 (PAT validation, webhooks, comments)  │
│  • Security & Logging: Cryptr AES-256 PAT Encryption + Winston JSON Logs│
└─────────────────────────────────────────────────────────────────────────┘
                   ↕ HTTP (internal)             ↕ Database Driver
┌──────────────────────────────────────┐  ┌───────────────────────────────┐
│  AI RISK SIDECAR (Python / FastAPI)  │  │   DATABASE LAYER (MongoDB 7+) │
│  • Endpoint: POST /analyze           │  │   • Mongoose v8 Schemas:      │
│  • Static Analysis: `radon`          │  │     PullRequest, PREvent,     │
│    (Cyclomatic Complexity + LOC)     │  │     RiskAnalysis, PROutcome,  │
│  • AI Engine: Gemini 2.0 Flash       │  │     Contributor, MetricSnapshot│
│    (`response_schema` strict JSON)   │  │     JiraIssue, AISession,     │
│  • Runtime: Python 3.11+ / uvicorn   │  │     Retrospective, ActionItem │
└──────────────────────────────────────┘  └───────────────────────────────┘
```

---

## 2. Module 1: Non-Invasive GitHub Integration & Webhook Ingestion Engine

### A. Working Use Case & Design Rationale
A core engineering requirement of PRSentinel is that **developers should never have to install local plugins or change their command-line Git habits**. To achieve this, we designed our platform to integrate non-invasively at the repository level via GitHub Personal Access Tokens (PATs) and repository webhooks (`backend/routes/github.js`).

When an organization administrator connects their repository through our Connect Page (`/connect`), our backend validates their GitHub PAT via the `Octokit` REST client (`octokit.rest.repos.listForAuthenticatedUser()`). Once verified, the PAT is encrypted using **Cryptr AES-256 encryption** (`backend/models/User.js`) before being persisted to MongoDB, ensuring that access credentials are protected at rest while allowing our background services to interact securely with GitHub on behalf of the team.

### B. Decoupled Webhook Ingestion Workflow (`backend/routes/webhooks.js`)
When an engineer runs `git push` and opens or updates a pull request on GitHub, the GitHub webhook system immediately fires an HTTPS `POST` event to our gateway (`/api/webhooks/github`). Because high-velocity development teams can generate dozens of webhook events per minute during active sprint days, processing everything synchronously inside the Express route handler would cause high latency and potentially drop webhook connections.

To ensure our API remains responsive under heavy load, we implemented the **Decoupled Job Queue Pattern**:
1. **HMAC Signature Verification:** When the Express controller receives the payload, it first computes and verifies the cryptographic HMAC signature (`X-Hub-Signature-256`) using our stored webhook secret (`crypto.createHmac()`). This ensures that malicious actors cannot inject fake pull request events into our pipeline.
2. **Immediate Async Queueing:** Once validated, the controller immediately pushes the raw payload into **BullMQ** (`webhookQueue` inside `backend/jobs/`) and returns an `HTTP 202 Accepted` response to GitHub within milliseconds.
3. **Parallel Worker Fan-Out:** Our background workers pick up the queued payload asynchronously from Redis and fork the data into two concurrent processing pipelines:
   * **Telemetry Worker (`telemetryQueue`):** Enriches historical pull request state, calculates exact review times, and updates organizational KPI aggregates in MongoDB.
   * **Risk Intelligence Worker (`riskQueue`):** Extracts code diffs and triggers our Python FastAPI sidecar to evaluate code complexity and vulnerability risk.

---

## 3. Module 2: Retrospective Telemetry & Behavioral Analytics Engine

### A. Working Use Case & Agile Metrics
Traditional Agile velocity tracking often relies on subjective estimates like story points, which can obscure real bottlenecks—such as why a finished feature sat waiting for code review for four days. Our Retrospective Telemetry Engine automatically replaces guesswork with objective behavioral data (`backend/scripts/syncGitHub.js`).

Whenever a pull request event is processed by our `telemetryQueue` worker, the system queries Octokit to extract rich temporal timestamps (`createdAt`, `firstReviewAt`, `mergedAt`, `closedAt`) and calculates four fundamental indicators of engineering health:
* **Cycle Time (`mergedAt - createdAt`):** The total elapsed time from when a developer first opens a pull request to when the code successfully merges into the main branch.
* **Review Latency (`firstReviewAt - createdAt`):** The exact waiting time a developer experiences before a reviewer provides their first comment or approval. High review latency directly correlates with context-switching fatigue.
* **Code Churn Rate:** The frequency with which code files are repeatedly modified or rewritten across recent pull requests (`historicalModifications / totalPRs`). A high churn rate flags volatile code paths where requirements are unclear or regressions occur frequently.
* **Stagnation Probability Heuristic:** A proprietary mathematical formula that evaluates PR age, lack of assigned reviewers, and pending review cycles (`reviewerLoadIndex`) to predict whether a pull request is about to miss the current sprint deadline.

### B. Relational Data Modeling in MongoDB (`backend/models/`)
To support fast historical queries across our glassmorphic frontend, our Mongoose schema architecture (`models/`) models the engineering lifecycle with clear relational references and compound indexes:
* **`PullRequest.js`:** Stored as the primary operational entity, containing enriched fields (`title`, `state`, `author`, `cycleTime`, `reviewLatency`, `complexity`, `churnRate`, `stallReason`, and `riskScore`).
* **`PREvent.js`:** An immutable chronological event log tracking every specific action (`PR_OPENED`, `REVIEW_REQUESTED`, `COMMENT_ADDED`, `RISK_SCORED`). Compound indexes on `{ prId: 1, occurredAt: 1 }` allow our timeline views to load instantly.
* **`Contributor.js`:** Maintains developer profiles within an organization, tracking `totalPRs`, `avgCycleTime`, and their current active review workload (`reviewerLoadIndex`) to enable smart, workload-balanced reviewer assignment.
* **`MetricSnapshot.js`:** A time-series aggregate collection that calculates daily organizational KPI averages (`avgCycleTime`, `throughput`, `churnRate`, and `wipCount`). By pre-calculating these snapshots, our dashboard KPI cards (`30d / 60d / 90d`) render without having to aggregate thousands of raw PR records on every page load.

### C. Real-Time Synchronization via Socket.IO (`backend/socket/index.js`)
When background workers finish updating a `PullRequest` or `MetricSnapshot` in MongoDB, our Express server uses **Socket.IO** to broadcast live state changes directly to the organization's dedicated WebSocket room (`io.to(orgId).emit('pr:updated', { prId, status })` and `io.to(orgId).emit('metrics:updated')`).

On the frontend, our TanStack React Query (`useQuery`) hooks are wired directly into our Socket.IO client (`frontend/src/hooks/useSocket.ts`). When a `pr:updated` event arrives over the websocket, the client immediately invalidates the affected query cache (`queryClient.invalidateQueries({ queryKey: ['prs'] })`). This triggers a silent background refetch, causing the dashboard KPI cards, Recharts time-series graphs, and open PR tables to update smoothly in real time without a page refresh.

---

## 4. Module 3: Proactive Risk Intelligence & Python FastAPI Sidecar

### A. Working Use Case & Decoupled AI Architecture
While retrospective telemetry tells us how fast a team is moving, it does not evaluate the **technical safety or complexity** of the code being introduced. To intercept high-risk pull requests before they merge into production, we built our Proactive Risk Intelligence Engine (`backend/jobs/riskQueue.js`).

Because string parsing, AST evaluation, and LLM network inference are heavy, blocking tasks, we decoupled our AI engine into a standalone **Python FastAPI microservice (`backend/main.py`)** running on `POST /analyze`. When the Node.js `riskQueue` worker receives a pull request diff, it sends a structured JSON payload to the FastAPI sidecar containing the raw diff string and historical repository metadata.

### B. Stage 1: Deterministic Static Code Complexity (`radon`)
Before invoking any generative AI models, our Python sidecar calculates deterministic mathematical ground truth using static analysis (`_calculate_static_metrics(diff, files)` inside `main.py`):
1. **Line & File Impact Analysis:** The sidecar parses the diff headers (`+++ b/src/...`) to compute `linesAdded`, `linesRemoved`, and total distinct files modified.
2. **Cyclomatic Complexity Delta (`radon`):** For Python code additions, the sidecar executes the **`radon`** static complexity analyzer (`radon.complexity.cc_visit()`). Cyclomatic complexity measures the exact number of independent linear paths through a source code block—counting `if/else` conditionals, `for/while` loops, and `try/except` handlers. A positive complexity delta (`+12 CC`) mathematically proves that the developer introduced intricate branching logic.
3. **Historical Churn Integration:** The sidecar checks the file's historical churn metric against MongoDB, classifying the modification into an objective `Complexity Class: S / M / L / XL` based on net code volume and volatility history.

### C. Stage 2: Structured LLM Reasoning (`Gemini 2.0 Flash` & `_gemini_response_schema`)
Once our deterministic metrics (`radon` complexity + churn history) are established, we pass them alongside the raw code diff into our generative AI engine powered by **Gemini 2.0 Flash (`0.24.1`)**. 

A critical engineering innovation in PRSentinel is how we prevent AI hallucinations. If you ask an LLM for unstructured markdown feedback, it often returns verbose, generic text that cannot be parsed by backend software. To guarantee exact software reliability, `main.py` configures the Gemini inference call with strict JSON schema enforcement (`generationConfig: { responseMimeType: 'application/json', responseSchema: _gemini_response_schema() }`).

The Gemini prompt instructs the model to evaluate the diff across four specific vulnerability axes:
* **Dependency Risk (0–10):** Does the diff modify `package.json`, `requirements.txt`, or environment variables, introducing untested third-party libraries?
* **Logic Risk (0–10):** Synthesizing our `radon` complexity delta, does the code introduce deep nested conditionals or unhandled edge cases?
* **Data Exposure (0–10):** Does the code path interact with database queries, API credentials, PII structures, or authentication tokens without proper sanitization?
* **Testing Coverage (0–10):** Are the newly introduced logic paths exercised by unit tests within the diff?

The model synthesizes these 4 axes into a normalized **Risk Score (0.0 to 10.0)** and returns a guaranteed JSON structure matching our system schema:
```json
{
  "risk_score": 7.2,
  "risk_label": "HIGH",
  "rationale": [
    "Modifies core payment processing module with high historical churn.",
    "Spike in cyclomatic complexity (+12 CC) due to 5-level nested branching."
  ],
  "radar": {
    "dependency_risk": 4.0,
    "logic_risk": 8.5,
    "data_exposure": 9.0,
    "testing_coverage": 3.0
  },
  "recommended_reviewers": ["payment-lead", "security-reviewer"],
  "annotated_diff_flags": [
    {
      "line": 42,
      "severity": "HIGH",
      "note": "Unsanitized input passed directly to database query handler."
    }
  ]
}
```

### D. Automated GitHub Bot Feedback & Label Routing (`Octokit`)
When the Python sidecar returns this structured JSON document back to our Node.js `riskQueue.js` worker, the system immediately closes the feedback loop inside GitHub:
1. **Database Persistence:** The full analysis document (including radar dimensions and line-by-line diff annotations) is saved to MongoDB (`backend/models/RiskAnalysis.js`).
2. **Automated PR Thread Comment:** Using `octokit.rest.issues.createComment()`, the bot posts a cleanly formatted markdown table directly inside the pull request discussion (`🤖 PRSentinel Risk Assessment`), displaying the numerical score, confidence level, rationale bullets, and a direct link to the full dashboard deep-dive (`/risk/:prId`).
3. **Intelligent Risk Labeling & Routing:** Using `octokit.rest.issues.addLabels()`, our bot categorizes the pull request based on its risk score:
   * **🟢 Score 0.0 – 3.0 (`Risk: Low` / `Fast-Track`):** Routine documentation, CSS, or simple configuration tweaks. The bot applies a fast-track label, allowing maintainers to approve it instantly.
   * **🟡 Score 3.1 – 5.9 (`Risk: Medium`):** Standard feature additions requiring normal review cycles.
   * **🔴 Score 6.0 – 7.9 (`Risk: High` / `Needs Review`):** High complexity or sensitive module changes. The bot automatically routes review requests (`octokit.rest.pulls.requestReviewers()`) to domain experts who have historical review familiarity with those specific files (`backend/routes/autoAssign.js`).
   * **🚨 Score 8.0 – 10.0 (`Risk: Critical` / `Do Not Merge`):** Severe security risks, secret exposure, or massive complexity spikes. The bot alerts the Tech Lead and flags the PR for mandatory security verification.

---

## 5. Module 4: Glassmorphic Frontend & Interactive Visualizations

### A. Working Use Case & Modern UI Engineering (`React 19` + `Vite` + `Tailwind CSS`)
While our automated GitHub bot serves developers directly where they code, engineering leads and reviewers need a centralized command center to analyze system health. We built our single-page application using **React 19, TypeScript, and Vite**, implementing a responsive, glassmorphic design system with **Tailwind CSS**.

To ensure our UI remains clean and maintainable, we separated state management into two distinct layers:
* **Client UI State (`Zustand`):** Lightweight, atomic stores (`useAuthStore`, `useFilterStore`, `useThemeStore`) handle user authentication tokens, active repository filter dropdowns (`selectedRepo`), and time-window selectors (`30d / 60d / 90d`).
* **Server Data State (`TanStack React Query v5`):** All asynchronous data fetching (`/api/metrics/dashboard`, `/api/prs/list`, `/api/risk/:prId`) is managed by TanStack Query (`useQuery`). This gives our frontend built-in response caching, query deduplication across components, and automatic background refetching when our Socket.IO client catches live data updates (`useSocket.ts`).

### B. Interactive D3.js Force-Directed Physics Simulations
Rather than relying solely on standard tables or static bar charts, PRSentinel utilizes **D3.js v7** (`d3-force`) to create interactive, exploratory data visualizations that allow tech leads to diagnose systemic bottlenecks visually:

#### 1. The Stagnation Bubble Matrix (`frontend/src/pages/PRHealthPage.tsx` & `/pr-health`)
To help tech leads spot stalled pull requests at a single glance before sprint velocity drops, we built our Stagnation Bubble Matrix using a 2D physics simulation:
* **Physics Simulation Initialization:** We initialize a D3 simulation (`d3.forceSimulation(prs)`) with `d3.forceCollide()` and `d3.forceManyBody()` so that open pull requests float naturally as distinct bubbles without overlapping on the canvas.
* **Bubble Radius (`r` — Age Mapping):** We scale each bubble's physical radius dynamically based on the pull request's open age (`d3.scaleLinear().domain([minAge, maxAge]).range([20, 70])`). An older pull request physically expands on the screen, drawing the lead's eye immediately.
* **Bubble Color (Stall Reason Mapping):** We map bubble color using `d3.scaleOrdinal()` corresponding to our backend telemetry stall heuristics:
  * **Red (`#EF4444` — `NO_REVIEWER`):** The pull request has been open for over 24 hours but zero reviewers have been assigned.
  * **Orange (`#F97316` — `CHURNING`):** The code has undergone repeated review rejection and high file churn, indicating rework.
  * **Yellow (`#EAB308` — `COMPLEX_IN_REVIEW`):** A massive, high-complexity diff is sitting in active review, slowing down the assigned reviewer.
* **Interactive Auto-Assign Drawer:** When a tech lead clicks on any floating bubble (`on('click')`), the frontend opens a slide-over diagnostic drawer (`autoAssign.js`). The drawer lists available domain reviewers ranked by their current open workload index (`reviewerLoadIndex`), allowing the lead to assign an unblocked reviewer with one click.

#### 2. The Collaboration & Reviewer Heatmap (`frontend/src/pages/HeatmapPage.tsx` & `/heatmap`)
To ensure knowledge is shared evenly across the engineering team, our Heatmap module renders a force-directed network graph where nodes represent individual developers (`Contributors`) and edges represent historical review relationships (`A reviewed B's pull request`).
* **Silo Detection:** If a critical domain (e.g., payment processing or authentication) has only one single incoming review edge from one senior maintainer, the graph highlights a **Knowledge Silo**—alerting the lead that the team has a single-point-of-failure bus factor.
* **Rubber-Stamp Detection:** If a reviewer node shows dozens of rapid outgoing review edges but extremely low comment-per-review ratios, the system flags a **Rubber-Stamp Reviewer**—identifying situations where PRs are being approved without thorough checking.

### C. The 5-Axis Developer Growth Scorecard (`frontend/src/pages/ScorecardPage.tsx` & `/scorecard`)
A fundamental design philosophy of our capstone team is that **developer metrics should be comparative, educational, and strictly anti-ranking**. In many engineering orgs, leaderboard metrics that simply rank developers by "lines of code merged" or "pull request count" incentivize sloppy code and competitive toxicity.

Our Developer Scorecard visualizes individual engineering health using a balanced **5-axis Recharts Radar Chart**:
* **Velocity:** Measured by average cycle time and pull request completion rate.
* **Review Quality:** Measured by the depth, actionability, and constructive nature of comments left on peers' pull requests.
* **Code Complexity:** Measured by how consistently the developer introduces clean, low-complexity code (`radon` CC averages).
* **Collaboration:** Measured by willingness to review peers' code and cross-pollinate knowledge across multiple repository domains.
* **Thoroughness:** Measured by the ratio of well-tested, low-churn pull requests submitted versus pull requests requiring multiple rework iterations.

By rendering these 5 axes simultaneously, engineering managers and developers can celebrate holistic contributions—such as an engineer who may merge fewer PRs but acts as an exceptional reviewer and mentor—fostering a collaborative Agile engineering culture.

---

## 6. Module 5: Agile Sprint Co-Pilot & Retrospective Suite

### A. Working Use Case & Automated Scrum Master Intelligence
During typical Agile sprint planning and retrospective meetings, Scrum Masters and Tech Leads spend hours manually digging through Jira boards and Git commit histories to understand what happened over the last two weeks. Our Agile Sprint Co-Pilot (`backend/routes/ai.js` and `/api/ai/chat`) automates this administrative overhead by acting as a stateful, data-grounded conversational assistant (`AIAssistantPage.tsx` & `/ai`).

Unlike generic chat tools, our AI Assistant maintains stateful conversation sessions (`backend/models/AISession.js`) that are dynamically injected with live organizational context:
1. **Live Data Injection:** Before sending the user's prompt (`"Why did our average cycle time increase during Sprint 3?"`) to Gemini 2.0 Flash, `routes/ai.js` fetches the current `MetricSnapshot`, recent high-risk pull requests, open `JiraIssue` correlations (`models/JiraIssue.js`), and active `ActionItem` records (`models/ActionItem.js`).
2. **Factual Grounding:** Because the LLM receives exact temporal timestamps and stall reason codes inside its system prompt (`contextWindow`), it answers with concrete factual accuracy—such as pointing out that *"Cycle time spiked because 4 authentication PRs sat stalled for 72 hours due to `NO_REVIEWER` assignment between October 12th and October 15th."*

### B. Automated Retrospective & Action Item Tracking (`/retrospective`)
To ensure our capstone directly models industrial Agile software delivery (`backend/routes/retrospective.js`), our platform includes a complete **Retrospective Suite (`RetrospectivePage.tsx`)**:
* **AI Sprint Synthesis:** At the conclusion of a sprint, the backend automatically compiles all merged pull requests, review latency percentiles, and risk distribution charts into an AI-synthesized Sprint Review (`models/Sprint.js`). It categorizes insights into structured sections: *What Went Well*, *Major Bottlenecks*, and *Systemic Risk Observations*.
* **Longitudinal Action Item Tracking:** During the retrospective, the team records concrete improvement goals inside our **Action Item Tracker** (`models/ActionItem.js`). Unlike static document notes, these action items (`OPEN`, `IN_PROGRESS`, `CLOSED`) are linked directly to the organization's schema and carry forward across future sprint comparisons (`/api/retrospective/compare`). If an action item (`"Enforce mandatory peer review on auth modules"`) remains unaddressed by the next sprint, the system surfaces it on the dashboard until resolved—closing the loop between what the team measures and what the team actually improves.

---

## 7. Honest Architectural Implementation & Roadmap Matrix (`Architecture.md` vs. Live Codebase)

A hallmark of high-quality software engineering is absolute transparency regarding current functional capabilities versus architectural roadmap plans. During capstone evaluations, presenting a clear, honest audit of our codebase (`integration_2.md`) demonstrates maturity and mastery over our multi-tier architecture.

The table below outlines our exact functional baseline achieved during the semester alongside our immediate phase-two architectural hardening plans:

| Architectural Component | Current Live Codebase Status | Technical Implementation Details & Operational Rationale |
| :--- | :---: | :--- |
| **Winston Structured Logging** | 🟢 **LIVE & FUNCTIONAL** | `backend/config/logger.js` implements comprehensive JSON-formatted, timestamped, console-colorized logging across all API controllers, job workers, and database operations. |
| **MongoDB Schema Architecture** | 🟢 **LIVE & FUNCTIONAL** | All Mongoose models (`PullRequest`, `PREvent`, `RiskAnalysis`, `PROutcome`, `Sprint`, `ActionItem`, `Contributor`, `MetricSnapshot`, `JiraIssue`, `AISession`) are fully built with compound indexing and relational integrity. |
| **Python Sidecar (`radon` + Gemini)** | 🟢 **LIVE & FUNCTIONAL** | `backend/main.py` successfully calculates `radon` cyclomatic complexity deltas and executes structured JSON prompt inference via `gemini-2.0-flash` (`_gemini_response_schema()`). |
| **D3.js & Recharts Visualizations** | 🟢 **LIVE & FUNCTIONAL** | `DashboardPage.tsx`, `CycleTimePage.tsx`, `ScorecardPage.tsx`, and `PRHealthPage.tsx` (Stagnation Bubble Matrix) render live, interactive data visualizations wired to Socket.IO. |
| **GitHub Bot Ingestion & Automation** | 🟢 **LIVE & FUNCTIONAL** | Webhook verification (`webhooks.js`), Octokit PAT authentication, automated PR thread commenting, risk labeling, and reviewer routing operate end-to-end. |
| **BullMQ Async Workers (`riskQueue`)** | 🟡 **LIVE WITH FALLBACK** | `riskQueue.js` processes background jobs through Redis when active, and includes a robust inline execution mode (`processInline()`) ensuring our backend functions without failure even if a local Redis server is down during demonstrations. |
| **Socket.IO Event Synchronization** | 🟡 **LIVE & FUNCTIONAL** | Socket.IO emits `pr:updated` and `metrics:updated` to trigger TanStack Query cache invalidations (`useSocket.ts`). We are refining event naming across legacy endpoints (`autoAssign.js`) to ensure 100% badge consistency. |
| **Zod / Joi Runtime Schema Validation** | 🔴 **PHASE 2 ROADMAP** | Express API controllers (`webhooks.js`, `jira.js`) currently destructure request payloads directly. Adding universal middleware validation (`validate(zodSchema)`) is scheduled for our phase-two hardening sprint. |
| **Secure `HttpOnly` Cookie Auth** | 🔴 **PHASE 2 ROADMAP** | Currently, `useAuthStore` stores JWT authentication tokens in `localStorage` for rapid prototyping. For production deployment, our login endpoints are transitioning to issue `HttpOnly`, `Secure`, `SameSite=Strict` cookies to eliminate XSS token exfiltration risks. |
| **Neo4j Graph Blast Radius Engine** | 🔴 **PHASE 2 ROADMAP** | Our container infrastructure (`docker-compose.yml`) includes `neo4j:5-community`. In Phase 2, we are integrating `neo4j-driver` (`backend/config/neo4j.js`) and AST import parsers to dynamically trace multi-repository microservice blast radius (`blastRadius.affectedServices`). |
| **Bandit & Semgrep AST Scanners** | 🔴 **PHASE 2 ROADMAP** | While `radon` calculates live complexity today, adding `bandit` (`Python security patterns`) and `semgrep` (`SQL injection / secret detection rules`) to `requirements.txt` inside `main.py` is planned for our deep static analysis extension. |
| **MongoDB TTL Indexes (`PREvent`)** | 🔴 **PHASE 2 ROADMAP** | `PREvent.js` utilizes compound indexes (`{ prId: 1, occurredAt: 1 }`). Adding a MongoDB TTL index (`{ expireAfterSeconds: 7776000 }` / 90 days) will be added prior to enterprise deployment to automate historical event purging and prevent storage bloat. |

---

## 8. Conceptual Discussion Guides for Presentation & Evaluation

To help presenters articulate the engineering decisions and practical trade-offs behind our build without relying on memorized trivia, these four conceptual guides summarize the fundamental "why and how" of PRSentinel:

### A. Decoupling Event Ingestion from Heavy Analysis (`Express` + `BullMQ` + `Python Sidecar`)
**Engineering Principle:** *Separation of Concerns & Asynchronous Non-Blocking Execution.*
During a live demonstration, explain why we did not write one massive monolithic Express function to handle everything. When GitHub sends a webhook, the Express API must respond within milliseconds (`HTTP 202 Accepted`) or GitHub will assume our server is dead and retry or drop the payload. 

By immediately pushing the raw event into **BullMQ**, our API stays lightning-fast. Furthermore, running mathematical static analysis (`radon`) and waiting for network inference from an LLM (`Gemini 2.0 Flash`) takes 2 to 5 seconds. If we ran those tasks directly inside Node.js, the single-threaded event loop would block, freezing the dashboard for every other connected user. Isolating heavy computation inside our **Python FastAPI Sidecar (`main.py`)** ensures that data ingestion, WebSocket streaming, and AI risk scoring operate concurrently without resource starvation.

### B. Combining Deterministic Static Code Metrics with Generative AI (`radon` + `Gemini`)
**Engineering Principle:** *Grounding Generative Models with Deterministic Mathematical Truth.*
Evaluators are often skeptical of AI-driven developer tools due to concerns over model hallucinations. Presenters should explain how PRSentinel's hybrid design eliminates guesswork: an LLM alone cannot reliably count exact lines of code or compute cyclomatic complexity across nested loops. 

By executing **`radon`** first, we establish hard, deterministic mathematical truth (`+12 CC complexity delta across 3 functions`). We then feed these exact numbers alongside our MongoDB historical churn statistics into **Gemini 2.0 Flash**. By enforcing a strict JSON response schema (`_gemini_response_schema()`), we use the LLM specifically for what it excels at—semantic reasoning, contextual explanation (`rationale`), and multi-dimensional scoring (`radar`)—while guaranteeing that our Express backend receives validated, machine-readable JSON structures every time.

### C. Designing Educational, Anti-Ranking Developer Metrics (`Scorecard` vs. Vanity Story Points)
**Engineering Principle:** *Anti-Ranking Human-Centric Software Engineering Telemetry.*
When discussing the **Developer Growth Scorecard (`/scorecard`)**, emphasize how our Agile team consciously rejected single-dimension leaderboards. If an engineering platform ranks developers purely by "lines of code written" or "pull requests merged," developers naturally adapt by submitting large, sloppy pull requests or rushing through code reviews without leaving constructive feedback.

Our **5-axis Recharts Radar (`Velocity`, `Review Quality`, `Complexity`, `Collaboration`, `Thoroughness`)** provides a balanced, educational framework. It highlights that a developer who merges fewer features but consistently writes clean, low-complexity code (`Thoroughness` / `Complexity`) and leaves thoughtful review comments (`Review Quality` / `Collaboration`) is providing immense value to the organization. This comparative visualization turns raw backend telemetry into a supportive mentoring tool for Tech Leads and Scrum Masters.

### D. Real-Time State Synchronization in Modern Single-Page Applications (`Socket.IO` + `TanStack Query`)
**Engineering Principle:** *Server-State Caching vs. Real-Time Push Notification.*
When navigating from our dashboard (`/dashboard`) to our D3.js Stagnation Matrix (`/pr-health`), explain how our frontend ensures 100% data freshness across multiple users. In traditional web applications, users must constantly press `F5` to see if a pull request was merged or reviewed.

In PRSentinel, we combined **TanStack React Query v5** (`useQuery`) with **Socket.IO (`useSocket.ts`)**. TanStack Query manages our server data cache, ensuring fast initial page renders and eliminating duplicate API requests across components. Meanwhile, our Socket.IO connection acts as an active listener: the exact moment our backend `telemetryQueue` worker updates a pull request in MongoDB, the server emits a `pr:updated` event to the organization's websocket room. Our frontend catches this event and calls `queryClient.invalidateQueries()`, prompting TanStack Query to silently refetch only the modified dataset in the background. This creates a seamless, responsive command center where KPI cards tick and D3 physics bubbles change color in real time right before the user's eyes.
