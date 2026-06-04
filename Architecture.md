# PRSentinel — Engineering Intelligence Platform
**Unified Project Specification & Architecture Document**
**Version:** 1.1 | **Date:** May 2, 2026 | **Status:** Active Development

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [User Personas](#4-user-personas)
5. [User Flows & Journey Maps](#5-user-flows--journey-maps)
6. [System Architecture](#6-system-architecture)
7. [Technology Stack](#7-technology-stack)
8. [Backend — Component Inventory](#8-backend--component-inventory)
9. [Frontend — Component Inventory](#9-frontend--component-inventory)
10. [AI & Risk Intelligence Pipeline](#10-ai--risk-intelligence-pipeline)
11. [Dashboard & Visualization Panels](#11-dashboard--visualization-panels)
12. [Data Models](#12-data-models)
13. [Security Architecture](#13-security-architecture)
14. [Performance & Scalability Targets](#14-performance--scalability-targets)
15. [Deployment Architecture](#15-deployment-architecture)
16. [Implementation Roadmap](#16-implementation-roadmap)
17. [Success Metrics & KPIs](#17-success-metrics--kpis)
18. [Risk Assessment & Mitigation](#18-risk-assessment--mitigation)
19. [Glossary](#19-glossary)

---

## 1. EXECUTIVE SUMMARY

### Vision Statement

**PRSentinel** is a unified engineering intelligence platform that replaces subjective gut-feel engineering decisions with a data-driven, AI-powered co-pilot. It gives engineering teams a real-time window into their development health — spanning team behavioral telemetry, code review quality, sprint velocity, knowledge distribution, and proactive pull request risk analysis — all from a single, cohesive interface.

### What PRSentinel Does

PRSentinel ingests GitHub pull request activity and Jira issue data to continuously compute behavioral insights about how a team works. Simultaneously, every time a developer opens or updates a pull request, PRSentinel's AI Risk Engine analyses the code diff, scores the inherent production risk (0–10), and automatically posts a structured assessment back to the GitHub PR thread — routing the right reviewers, flagging security concerns, and surfacing a blast radius of downstream services affected by the change.

The result is a platform that works at two levels simultaneously: a **retrospective intelligence layer** that helps teams understand how they have been working, and a **proactive risk layer** that prevents production incidents before they happen.

### Business Value

| Metric | Expected Impact |
|--------|-----------------|
| **Production Incidents Prevented** | 35–50% reduction in post-merge regressions |
| **Review Cycle Time** | 20–30% reduction for low-risk PRs (fast-tracked) |
| **Reviewer Efficiency** | 25–40% increase in high-value review capacity |
| **Knowledge Silo Detection** | Real-time identification of bus-factor risks |
| **Developer Onboarding** | 40% faster via scorecard + heatmap visibility |
| **Sprint Predictability** | Improved via retrospective tracking + stagnation detection |

---

## 2. PROBLEM STATEMENT

Modern engineering teams at scale suffer from a consistent set of compounding dysfunctions:

**During Code Review:**
- Reviewers suffer cognitive overload, missing subtle systemic risks buried in large diffs.
- Manual risk triage creates bottlenecks; the wrong reviewer gets assigned to the wrong PR.
- Institutional knowledge about high-risk modules exists only in senior engineers' heads.
- A payment service change and a CSS tweak are treated with equal urgency — or equal neglect.

**In Sprint Execution:**
- Team velocity is measured with vanity metrics (story points) that mask real bottlenecks.
- PRs stagnate for days with no reviewer, no one notices until deadlines slip.
- Knowledge concentrates around a few senior engineers; juniors have no visibility into where they should grow.
- Production incidents caused by specific PRs are never correlated back to what made those PRs risky.

**At the Leadership Level:**
- No single view exists of team health across repositories, contributors, and sprints.
- Security engineers manually triage hundreds of PRs to find the few that actually matter.
- Sprint retrospectives are subjective, qualitative, and fail to capture systemic patterns.

PRSentinel exists to solve all of the above with a single platform.

---

## 3. SOLUTION OVERVIEW

PRSentinel operates as four complementary systems working in unison:

### System 1 — Behavioral Telemetry Engine
Continuously ingests GitHub PR activity (via webhooks and Octokit sync) and computes team-level behavioral metrics: cycle time, churn rate, review latency, stagnation patterns, throughput, and work-in-progress distribution. These metrics are stored as time-series snapshots and surfaced on an analytics dashboard.

### System 2 — AI Risk Intelligence Engine
Every time a PR is opened or updated, a risk analysis pipeline fires asynchronously. It fetches the code diff, analyzes it using a structured LLM call (Gemini 2.0 Flash) augmented by static code metrics, posts a formatted risk assessment comment back to the GitHub PR thread (with a risk score, rationale, and reviewer mentions), and stores the full analysis in the database for dashboard deep-dive.

### System 3 — Knowledge & Collaboration Graph
Using Neo4j's graph database and D3.js force-directed visualizations, PRSentinel maps who reviews whose code, identifies knowledge silos (files touched by only one person), detects rubber-stamp reviewers, and generates a blast radius dependency graph showing which services are downstream of any modified file.

### System 4 — AI Co-Pilot & Sprint Intelligence
A stateful Gemini-powered chat assistant that answers natural language questions about team sprint health, explains stall reasons, and grounds every response in live MetricSnapshot data. Paired with a fully-featured Retrospective system — spanning structured sprint records, longitudinal action item tracking, and sprint-over-sprint health comparisons — PRSentinel closes the loop between what a team measures and what a team actually improves. Jira integration surfaces issue lifecycle context directly on PR detail views, eliminating the need to context-switch into Jira for correlation data.

### Key Differentiators

- **Non-Invasive:** Works entirely as a GitHub bot and a web dashboard — developers never leave their workflow.
- **Explainable:** Every risk score is accompanied by a structured rationale; the system never just says "this is risky."
- **Behavioral, Not Punitive:** Scorecards and metrics are comparative and anti-ranking — designed to help developers grow, not to rank them.
- **Real-Time:** Socket.IO ensures every open dashboard reflects live activity without a refresh.
- **Actionable:** From reviewer auto-assignment to sprint retrospectives, every insight comes with a clear next step.

---

## 4. USER PERSONAS

| Persona | Role | Primary Goals | Key Pain Points Solved |
|---------|------|---------------|------------------------|
| **Developer (PR Author)** | Feature contributor | Fast feedback, clear risk signal, minimal friction | Slow reviews, unclear rejection reasons, no sense of code impact |
| **Code Reviewer** | Domain expert / maintainer | Smart routing, visual risk context, no false alarms | Review fatigue, context-switching, missing subtle systemic risks |
| **Tech Lead** | Team leadership | Prevent outages, improve velocity, track team health | Knowledge gaps, no team-level visibility, reactive incident management |
| **Security Engineer** | Security champion | Automatic routing to security-sensitive PRs | Manual triage of all PRs, no signal for which ones matter |
| **Engineering Manager** | Org-level visibility | Sprint predictability, contributor health, reporting | Subjective retrospectives, anecdotal velocity reports |

---

## 5. USER FLOWS & JOURNEY MAPS

### Flow 1 — Developer Opens a Pull Request

```
TRIGGER: Developer pushes branch and opens PR on GitHub
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1 → GitHub emits pr.opened webhook
Step 2 → PRSentinel backend receives and queues in BullMQ (async)
Step 3 → Risk analysis pipeline fires (<5 seconds):
          ├─ Fetch PR diff + commit messages via Octokit
          ├─ Compute static metrics (LOC, churn, complexity class)
          ├─ Invoke Neo4j blast radius query (which services depend on modified files)
          ├─ Call Gemini with structured prompt → Risk score (0–10) + rationale
          └─ Persist full analysis to MongoDB

Step 4 → Bot posts formatted comment to GitHub PR thread:

  ┌────────────────────────────────────────────────────────────────┐
  │  🤖 PRSentinel Risk Assessment                                 │
  │                                                                │
  │  Risk Score: 🔴 7.2/10 (HIGH)   Confidence: 95%              │
  │                                                                │
  │  Rationale:                                                    │
  │  • Modifies core payment processor (high-risk module)          │
  │  • 340 lines added to a single function (complexity spike)     │
  │  • Affects 8 downstream services (blast radius)               │
  │  • New code paths lack test coverage                          │
  │                                                                │
  │  Actions Taken:                                                │
  │  • @payment-team has been requested for review                │
  │  • Label applied: Risk: High, Security Review                 │
  │                                                                │
  │  [📊 View Full Analysis on PRSentinel Dashboard]              │
  └────────────────────────────────────────────────────────────────┘

Step 5 → Developer sees the comment
          ├─ LOW RISK (0–3):   "Fast-track label applied, quick approval expected"
          ├─ MEDIUM RISK (4–6): "Normal review process, standard reviewer assigned"
          └─ HIGH RISK (7–10): "Security/expert review triggered, deep analysis recommended"

Step 6 → Developer optionally clicks dashboard link for deeper insight
Step 7 → Post-merge: System monitors outcome (errors, incidents) and stores label
```

**Time to Assessment:** < 5 seconds from PR open
**Developer Action Required:** Zero — the system is fully informational unless they want to explore

---

### Flow 2 — Reviewer Triages and Reviews a PR

```
TRIGGER: Reviewer receives @mention or auto-assignment notification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1 → Reviewer receives GitHub @mention + in-app Socket.IO notification
Step 2 → Decision point: GitHub PR only vs. Dashboard deep-dive

  PATH A: GitHub-only (60% of cases — low/medium risk PRs)
  ├─ Reads bot comment: score, rationale, auto-labels
  ├─ Scans code diff inline
  └─ Submits approve / request changes → done in 5–15 minutes

  PATH B: Dashboard deep-dive (35% of cases — high-risk PRs)
  ├─ Clicks deep-link from bot comment
  ├─ Views Blast Radius Heatmap (which services are affected)
  ├─ Reviews Complexity & Churn trends (is this file already problematic?)
  ├─ Examines Vulnerability Radar (Dependency / Logic / Data Exposure / Testing)
  ├─ Reads XAI Panel (why did the model score it this way? similar past PRs?)
  ├─ Reviews annotated side-by-side code diff
  └─ Submits decision directly from dashboard → done in 20–40 minutes

  PATH C: Fast-track (5% of cases — very low risk)
  ├─ Sees 🟢 LOW RISK label
  ├─ Skims diff (docs, config, UI tweaks)
  └─ Quick approve → done in 2–3 minutes

Step 3 → Post-review: Feedback logged; continuous learning updates risk model
```

---

### Flow 3 — Tech Lead Reviews Team Health on Dashboard

```
TRIGGER: Tech Lead opens PRSentinel dashboard at start of sprint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1 → Views KPI cards: Avg cycle time, throughput, churn rate, WIP count
Step 2 → Spots stagnating PRs in the Stagnation Bubble Matrix
          ├─ Each bubble = a PR (size = age, colour = stall reason)
          └─ Clicks a stagnant PR → triggers auto-assign suggestion

Step 3 → Reviews Knowledge Heatmap
          ├─ Identifies knowledge silos (e.g., only one person reviews auth code)
          ├─ Spots rubber-stamp reviewers (approves everything without substantive comments)
          └─ Plans pair-programming or knowledge transfer accordingly

Step 4 → Checks active high-risk PRs needing attention
Step 5 → Runs AI assistant query: "What's blocking team velocity this sprint?"
Step 6 → Opens Retrospective page:
          ├─ Selects current sprint (or creates new sprint record)
          ├─ Reviews AI-synthesized sprint summary (grounded in real metrics)
          ├─ Adds / closes action items from last sprint
          ├─ Compares current sprint health against previous 3 sprints
          └─ Records notes + exports retrospective PDF for the team
```

---

### Flow 4 — Organisation Onboarding

```
New user signs up → Firebase auth (email/social)
    ↓
Creates or joins Organisation (multi-tenant boundary)
    ↓
Navigates to /connect → Inputs GitHub Personal Access Token (PAT)
    ↓
Backend validates PAT via Octokit → encrypts and stores
    ↓
User selects repositories → clicks Sync
    ↓
BullMQ job runs syncGitHub.js:
  ├─ Fetches all PRs (paginated via Octokit)
  ├─ Computes cycle time, review latency, churn, stall reasons
  ├─ Links PRs to Jira issues (if Jira integration configured)
  └─ Persists MetricSnapshots to MongoDB
    ↓
Webhook configured → real-time updates active
    ↓
Dashboard populated → team is live on PRSentinel
```

---

## 6. SYSTEM ARCHITECTURE

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       PRSENTINEL PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │             FRONTEND (React 19 + TypeScript + Vite)              │  │
│  │  Glassmorphic UI (Tailwind CSS)   D3.js Force-Directed Graphs    │  │
│  │  Recharts Real-time Metrics       Socket.IO Live Updates         │  │
│  │  15+ Pages incl. Risk Dashboard   Radar, Heatmap, Diff Viewer   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↕ HTTP / WebSocket                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │          PRIMARY BACKEND (Node.js / Express + Socket.IO)         │  │
│  │                                                                  │  │
│  │  API Routes (15 route handlers)                                  │  │
│  │  ├─ /auth           Firebase + JWT                               │  │
│  │  ├─ /github         Octokit PAT + webhook ingestion             │  │
│  │  ├─ /metrics        Dashboard aggregation                        │  │
│  │  ├─ /prs            Pull request CRUD + detail                  │  │
│  │  ├─ /risk           Risk score retrieval + history              │  │
│  │  ├─ /ai             Gemini chat + sprint intelligence           │  │
│  │  ├─ /heatmap        Knowledge diffusion + blast radius + team   │  │
│  │  ├─ /scorecard      Developer metrics radar                     │  │
│  │  ├─ /jira           Issue sync + PR-ticket correlation          │  │
│  │  ├─ /auto-assign    Smart reviewer routing                       │  │
│  │  ├─ /retrospective  Sprint records, action items, comparisons   │  │
│  │  └─ /webhooks       GitHub event receiver                        │  │
│  │                                                                  │  │
│  │  Background Jobs (BullMQ)                                        │  │
│  │  ├─ webhookQueue     Real-time GitHub event processing           │  │
│  │  ├─ riskQueue        Async risk analysis pipeline                │  │
│  │  └─ snapshotQueue    Periodic metric snapshot computation        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↕ HTTP (internal)                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │        RISK INTELLIGENCE SIDECAR (Python / FastAPI)             │  │
│  │                                                                  │  │
│  │  POST /analyze  → Accepts PR diff + metadata                    │  │
│  │  ├─ Static Analyzer     LOC, churn, cyclomatic complexity        │  │
│  │  ├─ Gemini Structured   LLM risk score (0–10) + rationale       │  │
│  │  ├─ Vulnerability Scan  Security keyword detection + patterns    │  │
│  │  └─ Feature Packager    Packages features for score + XAI       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   PERSISTENCE LAYER                              │  │
│  │                                                                  │  │
│  │  MongoDB (Primary — OLTP)                                        │  │
│  │  ├─ Users, Organisations, Repositories                           │  │
│  │  ├─ PullRequests (enriched with metrics + risk scores)           │  │
│  │  ├─ PREvents, Contributors, MetricSnapshots                      │  │
│  │  ├─ RiskAnalyses (full AI analysis per PR)                      │  │
│  │  ├─ JiraIssues, AISession, Retrospective                        │  │
│  │  └─ PROutcomes (post-merge incident labels)                      │  │
│  │                                                                  │  │
│  │  Neo4j (Graph — OLAP)                                            │  │
│  │  ├─ Code Dependency Graph (blast radius traversal)              │  │
│  │  ├─ Team Collaboration Network (reviewer → author edges)        │  │
│  │  └─ Call Graph (PR impact propagation)                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │            CACHING & MESSAGE QUEUE LAYER                         │  │
│  │  Redis           BullMQ job queues + risk analysis cache        │  │
│  │  Socket.IO       Org-room broadcasting + 2-min state recovery   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

EXTERNAL SERVICES
  ├─ GitHub API (Octokit) — PR data, webhook source, bot comment posting
  ├─ Gemini 2.0 Flash — AI chat, risk scoring, changelog, retrospective
  ├─ Firebase Admin SDK — Authentication (OAuth)
  ├─ Jira REST API — Issue lifecycle + PR correlation
  └─ Sentry — Error tracking for post-merge production monitoring
```

---

### Data Flow — PR Opened Event (End to End)

```
GitHub PR.opened webhook
    ↓
POST /api/webhooks/github (Node.js backend)
    ↓ HMAC signature verified
BullMQ: webhookQueue enqueues event
    ↓
Job Worker picks up event → runs in parallel:

  BRANCH A: Behavioral Telemetry
  ├─ Octokit: fetch full PR metadata, commits, reviews
  ├─ Compute: cycle time, review latency, churn, complexity class
  ├─ Estimate: stall probability + stall reason
  ├─ Persist: PullRequest document to MongoDB
  ├─ Compute: MetricSnapshot delta for org
  └─ Socket.IO: broadcast update to org room

  BRANCH B: Risk Intelligence
  ├─ Octokit: fetch PR diff (file-level, line-level)
  ├─ POST to Python sidecar /analyze:
  │   ├─ Static analysis (LOC, cyclomatic complexity, churn history)
  │   ├─ Vulnerability keyword scan (secrets, PII, SQL patterns)
  │   ├─ Neo4j blast radius query (downstream dependency traversal)
  │   └─ Gemini structured risk call → score + rationale + radar dimensions
  ├─ Persist: RiskAnalysis document to MongoDB
  ├─ Octokit: POST bot comment to GitHub PR thread
  ├─ Octokit: Apply GitHub labels (Risk: High / Medium / Low)
  └─ Octokit: Request review from routed reviewer(s)

Frontend Dashboard
  ├─ Receives Socket.IO update → PR list refreshes
  └─ /risk/:prId endpoint serves full risk analysis on demand
```

---

## 7. TECHNOLOGY STACK

| Layer | Technology | Version | Role |
|-------|------------|---------|------|
| **Frontend Framework** | React | 19.2.5 | UI component model |
| **Build Tool** | Vite | 8.0.9 | Fast development + production builds |
| **Language (Frontend)** | TypeScript | ~6.0.2 | Type safety across all UI code |
| **Styling** | Tailwind CSS | 3.4.19 | Utility-first; glassmorphic design system |
| **State Management** | Zustand | 5.0.12 | Auth, filters, notifications, theme |
| **Server State** | TanStack React Query | 5.99.2 | API data fetching + caching |
| **Data Fetching** | Axios / fetch | — | HTTP requests to backend |
| **Charting** | Recharts | 3.8.1 | Time-series, bar, radar charts |
| **Graph Visualization** | D3.js | 7.9.0 | Force-directed graphs (heatmap, blast radius) |
| **Real-time** | Socket.IO Client | 4.8.3 | Live updates, org broadcasting |
| **Routing** | React Router | 7.14.1 | Client-side navigation |
| **Notifications** | react-hot-toast | 2.6.0 | In-app toasts |
| **Backend Framework** | Node.js / Express | 22 / 4.21.2 | Primary API server |
| **Real-time Server** | Socket.IO Server | 4.8.1 | WebSocket gateway |
| **Job Queue** | BullMQ | 5.75.2 | Async webhook + risk analysis jobs |
| **ORM** | Mongoose | 8.14.1 | MongoDB schema + query layer |
| **GitHub Client** | Octokit | 21.0.2 | PR fetch, webhook, bot comments |
| **Authentication** | Firebase Admin SDK | 13.3.0 | OAuth (email, Google, GitHub) |
| **JWT** | jsonwebtoken | — | Session management |
| **PAT Encryption** | Cryptr | 6.3.0 | AES-256 encryption of GitHub PATs |
| **Rate Limiting** | express-rate-limit | — | Global + per-endpoint protection |
| **Security Headers** | Helmet.js | — | HSTS, XSS, clickjacking protection |
| **Primary Database** | MongoDB | 7+ (Atlas) | Document store — all platform data |
| **Graph Database** | Neo4j | 5+ | Code dependency + collaboration graph |
| **Cache / Queue Backend** | Redis | 7+ | BullMQ backing store + inference cache |
| **Risk Sidecar** | Python / FastAPI | 3.11+ / 0.111+ | Static analysis + Gemini risk scoring |
| **AI / LLM** | Gemini 2.0 Flash | 0.24.1 | Risk scoring, chat, changelog, retrospective |
| **Static Analysis** | radon, pylint | — | Cyclomatic complexity, code quality metrics |
| **Security Scanning** | bandit, semgrep | — | Vulnerability pattern detection in diffs |
| **Error Tracking** | Sentry | — | Post-merge production incident detection |
| **Containerization** | Docker / Docker Compose | — | Local dev + staging environment |
| **CI/CD** | GitHub Actions | — | Automated test + deploy pipeline |

---

## 8. BACKEND — COMPONENT INVENTORY

### 8.1 Data Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| **User** | Developer identity | firebaseUid, email, githubUsername, role, orgId |
| **Organisation** | Multi-tenant root | name, GitHub config, Jira config, webhookSecret |
| **Repository** | GitHub repo metadata | fullName, repoUrl, githubId, orgId |
| **PullRequest** | Core enriched PR entity | title, state, author, cycleTime, reviewLatency, complexity, churnRate, stallReason, riskScore, riskLabel |
| **PREvent** | Temporal event log | action, timestamp, actor, prId |
| **RiskAnalysis** | Full AI risk analysis | prId, riskScore (0–10), riskLabel, rationale, blastRadius, radarDimensions (dependency/logic/dataExposure/testing), annotatedDiff, similarHistoricalPRs, botCommentPosted |
| **PROutcome** | Post-merge outcome label | prId, outcome (SAFE / REGRESSION / PREVENTED), incidentLinks, detectedAt |
| **Contributor** | Developer profile | username, avatar, totalPRs, avgCycleTime, orgId |
| **MetricSnapshot** | Time-series aggregate | timestamp, avgCycleTime, throughput, churnRate, wipCount, orgId, repoId |
| **JiraIssue** | Jira ticket correlation | key, status, assignee, dueDate, linkedPRIds, orgId |
| **AISession** | Gemini chat history | userId, messages[], model, contextWindow |
| **Retrospective** | Sprint review artifact | title, sprintDate, aiSummary, notes, actionItems, orgId |

### 8.2 API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/login` | POST | Firebase | User onboarding + JWT issuance |
| `/api/auth/refresh` | POST | Refresh Token | Extend session |
| `/api/github/connect-pat` | POST | JWT | Validate + encrypt GitHub PAT |
| `/api/github/repos` | GET | JWT | List accessible repositories |
| `/api/github/sync` | POST | JWT | Trigger manual full repository sync |
| `/api/metrics/dashboard` | GET | JWT | Aggregate KPI metrics (30/60/90 day) |
| `/api/metrics/cycle-time` | GET | JWT | Cycle time breakdown with percentiles |
| `/api/metrics/wip` | GET | JWT | Work-in-progress distribution |
| `/api/prs/list` | GET | JWT | Paginated PR list with filters |
| `/api/prs/:id` | GET | JWT | Single PR detail including events |
| `/api/risk/:prId` | GET | JWT | Full risk analysis for a PR |
| `/api/risk/history` | GET | JWT | Risk trend over time for an org |
| `/api/ai/chat` | POST | JWT | Stateful Gemini conversation with live sprint context |
| `/api/heatmap/reviewers` | GET | JWT | Collaboration graph (who reviews whose code) |
| `/api/heatmap/blast-radius/:prId` | GET | JWT | Neo4j dependency traversal for a PR |
| `/api/heatmap/team` | GET | JWT | Team member roster with metrics and roles |
| `/api/scorecard/:userId` | GET | JWT | Developer radar chart metrics |
| `/api/jira/sync` | POST | JWT | Sync Jira issue backlog |
| `/api/jira/pr-context/:prId` | GET | JWT | Jira issue metadata linked to a specific PR |
| `/api/auto-assign/suggest` | GET | JWT | Reviewer recommendations for a PR |
| `/api/auto-assign/assign` | POST | JWT | Confirm reviewer assignment |
| `/api/retrospective/sprints` | POST/GET | JWT | Create sprint records and list all sprints |
| `/api/retrospective/:sprintId` | GET/PATCH | JWT | Fetch or update a single sprint retrospective |
| `/api/retrospective/:sprintId/action-items` | POST/GET | JWT | Create and list action items for a sprint |
| `/api/retrospective/action-items/:itemId` | PATCH | JWT | Update action item status (open / in-progress / closed) |
| `/api/retrospective/compare` | GET | JWT | Sprint-over-sprint health comparison (last N sprints) |
| `/api/webhooks/github` | POST | HMAC Signature | Receive GitHub PR webhook events |
| `/api/outcomes/:prId` | POST | JWT (internal) | Record post-merge outcome label |

### 8.3 Background Jobs (BullMQ)

| Queue | Trigger | Function |
|-------|---------|----------|
| `webhookQueue` | GitHub webhook event | Parse and fan-out to telemetry + risk queues |
| `telemetryQueue` | Post-webhook | Sync PR metrics, compute snapshots, update MongoDB |
| `riskQueue` | Post-webhook | Fetch diff, call Python sidecar, post bot comment, store RiskAnalysis |
| `snapshotQueue` | Scheduled (nightly) | Compute and persist MetricSnapshot for all active orgs |
| `outcomeQueue` | Scheduled (48h post-merge) | Query Sentry for incidents; label PROutcome |

---

## 9. FRONTEND — COMPONENT INVENTORY

### 9.1 Pages

| Page | Route | Purpose |
|------|-------|---------|
| **LandingPage** | `/` | Public marketing + feature overview |
| **DashboardPage** | `/dashboard` | Main analytics hub — KPI cards, time-series, WIP gauge |
| **CycleTimePage** | `/cycle-time` | Cycle time histogram, percentile breakdown, trend line |
| **HeatmapPage** | `/heatmap` | Reviewer collaboration graph, silo detection, and team roster (tabbed) |
| **PRHealthPage** | `/pr-health` | Stagnation bubble matrix, stall reason highlights, auto-assign |
| **RiskPage** | `/risk` | Active high-risk PR queue, org-level risk trend chart |
| **PRRiskDetailPage** | `/risk/:prId` | Full risk dashboard: blast radius, complexity, radar, XAI, diff |
| **ScorecardPage** | `/scorecard` | Developer 5-axis radar (Velocity, Review Quality, Complexity, Collaboration, Thoroughness) |
| **JiraPage** | `/jira` | Jira connection config, project selector, and PR-ticket linkage status |
| **AIAssistantPage** | `/ai` | Stateful Gemini chat — sprint health, stall explanations, release notes |
| **ProfilePage** | `/profile` | User settings, GitHub PAT input, theme |
| **RetrospectivePage** | `/retrospective` | Full sprint retrospective system: sprint records, AI synthesis, action item tracker, sprint comparison |
| **RetrospectiveDetailPage** | `/retrospective/:sprintId` | Single sprint view with metrics, AI summary, action items, and export |
| **NotificationsPage** | `/notifications` | Stagnation alerts, review assignments, risk alerts |
| **SettingsPage** | `/settings` | Org config, repo management, webhook status |
| **ConnectPage** | `/connect` | GitHub PAT onboarding flow |

### 9.2 State Management

```typescript
// Zustand Stores
useAuthStore          // user, token, role, setAuth, clearAuth
useFilterStore        // days, selectedRepo, setDays, setRepo
useNotificationStore  // notifications[], addNotification, removeNotification
useThemeStore         // isDark, toggleTheme
useSocketStore        // connected, messages, emit
useRiskStore          // activeHighRiskPRs[], riskTrend[], setRisk
useRetrospectiveStore // sprints[], activeSprint, actionItems[], setSprint
```

### 9.3 Real-Time Events (Socket.IO)

| Event | Direction | Trigger |
|-------|-----------|---------|
| `pr:opened` | Server → Client | New PR opened in monitored repo |
| `pr:updated` | Server → Client | PR pushed, labeled, or commented on |
| `risk:analysis-complete` | Server → Client | Risk score computed and bot comment posted |
| `pr:reviewer-assigned` | Server → Client | Reviewer auto-assigned to a PR |
| `metric:snapshot-updated` | Server → Client | Nightly snapshot computed; KPI cards update |
| `notification:review-assigned` | Server → Client | Reviewer receives in-app alert |
| `notification:stagnation-detected` | Server → Client | PR stalled beyond threshold |

---

## 10. AI & RISK INTELLIGENCE PIPELINE

### 10.1 Pipeline Architecture

```
PR Diff + Metadata
        ↓
Python FastAPI Sidecar (/analyze)
        ↓
  ┌─────────────────────────────────────────────────────┐
  │  STATIC ANALYSIS MODULE                             │
  │  ├─ LOC added / removed / net                      │
  │  ├─ Number of files touched                        │
  │  ├─ Cyclomatic complexity delta (via radon)         │
  │  ├─ Churn history (how often has each file changed) │
  │  ├─ Complexity class (S/M/L/XL based on LOC)       │
  │  └─ Stall probability heuristic                    │
  └─────────────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────────────┐
  │  VULNERABILITY SCAN MODULE                          │
  │  ├─ Bandit: Python security patterns (if Python)    │
  │  ├─ Semgrep rules: hardcoded secrets, SQL injection │
  │  ├─ Keyword scan: PII terms, cryptographic refs     │
  │  └─ Dependency change detection (package.json diff) │
  └─────────────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────────────┐
  │  NEO4J BLAST RADIUS MODULE                          │
  │  ├─ Modified files → query Neo4j dependency graph   │
  │  ├─ Traverse: direct + transitive imports/calls     │
  │  ├─ Count downstream services affected             │
  │  └─ Return: blast_radius_count, affected_services[] │
  └─────────────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────────────┐
  │  GEMINI STRUCTURED RISK CALL                        │
  │  Input:                                             │
  │  ├─ PR diff (first 8,000 tokens)                   │
  │  ├─ Static metrics (LOC, complexity, churn)         │
  │  ├─ Blast radius count                             │
  │  ├─ Vulnerability scan findings                    │
  │  └─ Repository risk profile (is this a core module?)│
  │                                                     │
  │  System Prompt instructs Gemini to return JSON:     │
  │  {                                                  │
  │    risk_score: 0–10,                               │
  │    risk_label: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL",   │
  │    rationale: string[],                             │
  │    radar: {                                         │
  │      dependency_risk: 0–10,                        │
  │      logic_risk: 0–10,                             │
  │      data_exposure: 0–10,                          │
  │      testing_coverage: 0–10                        │
  │    },                                               │
  │    recommended_reviewers: string[],                 │
  │    annotated_diff_flags: [{line, severity, note}]  │
  │  }                                                  │
  └─────────────────────────────────────────────────────┘
        ↓
  Node.js Backend receives structured response
        ↓
  ├─ Persist RiskAnalysis to MongoDB
  ├─ Post formatted bot comment to GitHub via Octokit
  ├─ Apply GitHub labels (Risk: Low / Medium / High / Critical)
  ├─ Request review from recommended reviewers via Octokit
  └─ Emit Socket.IO 'risk:analysis-complete' to org room
```

### 10.2 Risk Score Breakdown

| Risk Score | Label | Reviewer Routing | GitHub Label |
|------------|-------|-----------------|--------------|
| 0 – 3.0 | 🟢 LOW | Standard reviewer (heuristic-based) | `Risk: Low`, `Fast-Track` |
| 3.1 – 5.9 | 🟡 MEDIUM | Senior maintainer of modified domain | `Risk: Medium` |
| 6.0 – 7.9 | 🔴 HIGH | Domain expert + @mention in PR | `Risk: High`, `Needs Review` |
| 8.0 – 10.0 | 🚨 CRITICAL | Security engineer + domain expert + Tech Lead notified | `Risk: Critical`, `Security Review`, `Do Not Merge` |

### 10.3 Reviewer Auto-Assignment Logic

```
Input: PR metadata, contributor list, risk score

Step 1 → Identify domain(s) from modified file paths
          (e.g., src/payments/* → "payments domain")

Step 2 → Query Contributor collection for:
          ├─ Who has reviewed code in this domain previously
          ├─ Who authored code in modified files (recent commits)
          └─ Who has the lowest current review load (open PRs assigned)

Step 3 → If risk score >= 6.0 → Gemini AI reviewer suggestion
          Prompt includes: "PR summary, risk factors, contributor history"
          Gemini returns: top 3 reviewers with reasoning

Step 4 → Merge heuristic + AI signals → ranked reviewer list
Step 5 → Auto-request review from top-ranked available reviewer
Step 6 → Record assignment method (ai_suggested / heuristic / manual)
```

### 10.4 Gemini AI Chat — Sprint Intelligence

The AI Assistant at `/ai` maintains a stateful Gemini conversation session (stored in AISession model) with full context of the organisation's current sprint metrics. Users can ask:

- "Why is our cycle time worse this sprint?"
- "Which PRs are most at risk of missing this week's release?"
- "Who should be reviewing authentication PRs based on history?"
- "Generate release notes for v2.4.0"
- "What patterns do you see across the last 3 sprints?"
- "Draft the retrospective summary for Sprint 12"

The backend injects current MetricSnapshot data, recent PRs, stagnation signals, and the active sprint's action item status into each Gemini call, making every response grounded in the team's actual data. Release note generation and retrospective drafting are handled here rather than as separate dedicated pages.

---

## 11. DASHBOARD & VISUALIZATION PANELS

### 11.1 Main Dashboard (`/dashboard`)

- **KPI Cards:** Avg cycle time, PR throughput, churn rate, active WIP count — all filterable by 30/60/90 day windows and by repository.
- **Time-Series Chart (Recharts):** Daily merged PRs + average cycle time trend over the selected period.
- **WIP Gauge:** Donut chart showing draft / in-review / awaiting-merge distribution.
- **Open PRs by State:** Bar chart breakdown of all active PRs.
- **Live updates** via Socket.IO — cards refresh without page reload.

### 11.2 Risk Dashboard (`/risk`)

- **Active High-Risk PR Queue:** Table of all currently open PRs with Risk: High or Critical labels, sorted by risk score descending.
- **Org Risk Trend Chart:** Line chart of average risk score across all PRs over time. Useful for identifying periods where riskier changes were being made (e.g., near deadlines).
- **Risk Distribution Histogram:** How many PRs this sprint fell into each risk bucket.

### 11.3 PR Risk Detail (`/risk/:prId`)

This is the deep-dive dashboard for a single PR, linked from every GitHub bot comment:

**Panel A — Blast Radius Heatmap**
Interactive D3.js force-directed graph where nodes are files and edges are import/dependency relationships. Modified files in this PR are highlighted; color indicates risk level (green → yellow → red). Hover tooltips show: "payment_processor.py — imported by billing_service, order_service, refund_service." Users can export the graph as SVG.

**Panel B — Complexity & Churn Trends**
Recharts line chart showing the cyclomatic complexity history of modified files over the past 6 months. Annotations flag: "High churn hotspot (changed 18x last quarter)", "Above average complexity baseline", "Spaghetti risk." The current PR's complexity delta is overlaid as a point event.

**Panel C — Vulnerability Radar Chart**
A 4-axis radar chart scored across:
- **Dependency Risk (20%):** How many and how critical are external packages touched?
- **Logic Risk (35%):** Cyclomatic complexity, control flow depth, conditional branching.
- **Data Exposure (25%):** Does the PR interact with PII, secrets, or sensitive data paths?
- **Testing Coverage (20%):** Are new code paths exercised by existing or newly added tests?

**Panel D — Explainable AI (XAI) Panel**
Transparency breakdown of why the model produced this risk score:
- Feature contribution list (e.g., "Blast radius: +2.1 pts, Complexity spike: +1.8 pts, Churn history: +1.3 pts")
- Model confidence interval (e.g., "95% confidence, score range 6.8–7.5")
- Similar historical PRs: "PR #4521 (3 months ago) had a similar blast radius — resulted in 2 bugs caught in testing"

**Panel E — Annotated Code Diff**
Side-by-side diff view with inline AI annotations:
- 🔴 High complexity: 6-level nested conditional
- ⚠️ Potential SQL injection: User input not sanitized
- 🔒 PII access: Credit card data touched here
- 📍 Similar pattern to bug #5031 (fixed April 2025)
- ✅ This code path is covered by existing tests

Users can leave inline review comments directly from the dashboard, synced back to GitHub.

### 11.4 Knowledge & Team Hub (`/heatmap`)

A two-tab page that consolidates team-level visibility.

**Tab 1 — Collaboration Graph**
D3.js force-directed graph of the team's review relationships. Each node is a developer; edges represent "A reviewed B's code." Edge thickness = frequency. The graph visually reveals:
- **Knowledge silos:** One person being the only reviewer for a critical domain.
- **Rubber stampers:** A reviewer whose edges are many but whose comments-per-review ratio is low.
- **Healthy distribution:** An evenly connected graph with broad review coverage.

Clicking any node opens an inline panel with that developer's scorecard preview (velocity, review quality, collaboration) and their current open review assignments.

**Tab 2 — Team Roster**
A card grid of all contributors in the organisation. Each card shows: avatar, GitHub username, role (viewer / contributor / manager / admin), current review load (open PRs assigned), and a mini-sparkline of their merge activity over the past 30 days. Role assignment and reviewer capacity limits are managed here. This replaces the former standalone `/team` page.

### 11.5 Stagnation Bubble Matrix (`/pr-health`)

D3.js bubble chart where each bubble is an open PR. Bubble size represents age (older = larger). Bubble color represents stall reason:
- `NO_REVIEWER` — Red
- `CHURNING` — Orange
- `COMPLEX_IN_REVIEW` — Yellow
- `WAITING_CI` — Blue
- `BLOCKED_DEPENDENCY` — Purple

Clicking a bubble opens the PR detail and triggers auto-assign suggestion.

### 11.6 Developer Scorecard (`/scorecard`)

Per-developer Recharts radar chart across five axes:
- **Velocity:** PRs merged per week vs. team average
- **Review Quality:** Comments left per review, change-request rate
- **Complexity Handled:** Average complexity of PRs reviewed
- **Collaboration:** Breadth of codebases reviewed, pairing frequency
- **Thoroughness:** Review-to-approval ratio, post-merge regression rate

Importantly, scorecards are not ranked leaderboards — they are individual growth maps showing a developer's profile relative to their own history.

### 11.7 Retrospective System (`/retrospective` and `/retrospective/:sprintId`)

The Retrospective feature is a first-class longitudinal sprint intelligence tool — not a wrapper around the AI chat.

**Sprint List Page (`/retrospective`)**
- Chronological list of all past sprint records for the organisation.
- Each row shows: sprint name, date range, overall health score (computed from avg cycle time, churn, stagnation rate vs. previous sprint), and action item completion rate.
- Colour-coded health trend arrow: improving ↑ / stable → / degrading ↓.
- "New Sprint" button creates a draft sprint record for the current period.
- Sprint comparison panel: select any two sprints to render a side-by-side diff of key metrics (cycle time, throughput, churn, risk score avg, action item completion).

**Sprint Detail Page (`/retrospective/:sprintId`)**

The detail page has four sections:

*Section A — Sprint Metrics Snapshot*
Auto-populated from MetricSnapshots for the sprint date range: avg cycle time, PRs merged, churn rate, WIP high-water mark, avg risk score, and number of HIGH/CRITICAL PRs. Displayed as KPI cards alongside a mini time-series for the sprint period.

*Section B — AI-Synthesized Summary*
Gemini generates a structured sprint narrative grounded in the actual snapshot data:
- What went well (low churn weeks, fast cycle times, good reviewer coverage)
- What struggled (stagnation spikes, knowledge silo events, HIGH risk PRs merged)
- Patterns detected vs. previous sprint (e.g., "Cycle time increased 18% — churn rate in `auth/` doubled")

The summary is editable — the tech lead can amend the AI draft before saving. Each summary is stored persistently; it is not regenerated on every page load.

*Section C — Action Item Tracker*
A kanban-style board with three columns: Open / In Progress / Closed. Each action item has: description, owner (assigned contributor), due date, linked sprint, and status. Action items carry forward automatically if not closed by the end of a sprint — they appear on the next sprint's retrospective with an "overdue" badge. Closing an action item prompts: "Did this actually improve the metric it was targeting?" — the answer is stored and surfaced in the sprint comparison view.

*Section D — Export*
One-click export of the sprint retrospective as a formatted PDF — metrics snapshot, AI summary, action item status — suitable for sharing with stakeholders outside PRSentinel.

---

## 12. DATA MODELS

### PullRequest (extended)

```javascript
{
  // GitHub identity
  githubId: Number,
  number: Number,
  title: String,
  description: String,
  author: String,
  state: String,           // open | closed | merged
  htmlUrl: String,
  headBranch: String,
  baseBranch: String,

  // Timestamps
  githubCreatedAt: Date,
  firstCommitAt: Date,
  firstReviewAt: Date,
  mergedAt: Date,

  // Computed behavioral metrics
  cycleTime: Number,         // hours: firstCommitAt → mergedAt
  reviewLatency: Number,     // hours: openedAt → firstReviewAt
  churnRate: Number,         // change requests / total reviews
  linesAdded: Number,
  linesRemoved: Number,
  filesChanged: Number,
  complexityClass: String,   // S | M | L | XL
  stallProbability: Number,  // 0.0–1.0
  stallReason: String,       // NO_REVIEWER | CHURNING | COMPLEX_IN_REVIEW | ...
  requestedReviewers: [String],

  // Risk intelligence (populated by riskQueue job)
  riskScore: Number,         // 0.0–10.0
  riskLabel: String,         // LOW | MEDIUM | HIGH | CRITICAL
  riskAnalysisId: ObjectId,  // ref: RiskAnalysis
  botCommentPosted: Boolean,
  botCommentId: String,

  // Relations
  orgId: ObjectId,
  repoId: ObjectId,
  jiraIssueKey: String
}
```

### RiskAnalysis (new)

```javascript
{
  prId: ObjectId,
  githubPrNumber: Number,
  repoId: ObjectId,
  orgId: ObjectId,

  // Scores
  riskScore: Number,         // 0.0–10.0
  riskLabel: String,
  confidence: Number,        // 0.0–1.0

  // Rationale
  rationale: [String],       // human-readable bullet points

  // Radar dimensions
  radar: {
    dependencyRisk: Number,
    logicRisk: Number,
    dataExposure: Number,
    testingCoverage: Number
  },

  // Blast radius
  blastRadius: {
    affectedServiceCount: Number,
    affectedFiles: [String],
    graphSnapshot: String    // JSON serialized Neo4j subgraph
  },

  // Static analysis
  staticMetrics: {
    linesAdded: Number,
    linesRemoved: Number,
    filesChanged: Number,
    cyclomaticComplexityDelta: Number,
    churnHistoryScore: Number,
    vulnerabilityFlags: [{ severity: String, message: String, line: Number }]
  },

  // Reviewer routing
  recommendedReviewers: [String],
  assignedReviewer: String,
  assignmentMethod: String,  // ai_suggested | heuristic | manual

  // Annotated diff
  diffAnnotations: [{
    file: String,
    line: Number,
    severity: String,
    note: String
  }],

  // Historical context
  similarHistoricalPRs: [{
    prNumber: Number,
    similarity: Number,
    outcome: String
  }],

  // Metadata
  analyzedAt: Date,
  geminiModelVersion: String
}
```

### PROutcome (new)

```javascript
{
  prId: ObjectId,
  orgId: ObjectId,
  mergedAt: Date,
  detectedAt: Date,
  outcome: String,           // SAFE | REGRESSION | PREVENTED
  incidentLinks: [String],   // Sentry issue URLs, PagerDuty incidents
  errorRateSpike: Boolean,
  reviewerFeedback: String,  // Optional: reviewer manually labels
  usedForRetraining: Boolean
}
```

### Sprint (new)

```javascript
{
  orgId: ObjectId,
  name: String,              // e.g., "Sprint 12 — May 2026"
  startDate: Date,
  endDate: Date,
  status: String,            // draft | active | closed

  // Auto-populated from MetricSnapshots for the sprint window
  metrics: {
    avgCycleTime: Number,    // hours
    prsmerged: Number,
    churnRate: Number,
    wipHighWaterMark: Number,
    avgRiskScore: Number,
    highRiskPrCount: Number,
    criticalRiskPrCount: Number
  },

  // Gemini-generated narrative (editable after generation)
  aiSummary: String,
  aiSummaryGeneratedAt: Date,
  summaryEditedByUserId: ObjectId,

  // Sprint health score (0–10, computed on close)
  healthScore: Number,
  healthTrend: String,       // improving | stable | degrading

  // Export
  exportedPdfUrl: String,
  exportedAt: Date,

  createdAt: Date,
  closedAt: Date
}
```

### ActionItem (new)

```javascript
{
  sprintId: ObjectId,        // which sprint this was created in
  orgId: ObjectId,
  description: String,
  owner: String,             // GitHub username of assigned contributor
  dueDate: Date,
  status: String,            // open | in_progress | closed
  priority: String,          // low | medium | high

  // Longitudinal tracking
  carriedForwardFromSprintId: ObjectId,  // if not closed in original sprint
  carriedForwardCount: Number,           // how many sprints this has been open

  // Outcome validation (filled when status → closed)
  outcomeNote: String,       // "Did this improve the metric it targeted?"
  metricImproved: Boolean,
  linkedMetric: String,      // e.g., "avgCycleTime", "churnRate"

  createdAt: Date,
  closedAt: Date
}
```

---

## 13. SECURITY ARCHITECTURE

| Layer | Implementation | Status | Notes |
|-------|---------------|--------|-------|
| **User Auth** | Firebase Admin SDK | ✅ Implemented | OAuth; no password handling |
| **API Auth** | JWT (httpOnly Secure Cookie) | 🔧 Target state | Migrate from localStorage to prevent XSS leakage |
| **GitHub PAT** | AES-256 via Cryptr | ✅ Implemented | Encryption key should move to Vault |
| **Secrets Management** | HashiCorp Vault (target) | 🔧 Target state | Replace `.env` key storage |
| **Webhook Verification** | HMAC-SHA256 signature | ✅ Implemented | Validates all GitHub events |
| **Rate Limiting** | express-rate-limit | ✅ Global; per-endpoint target | Add per-user limits on AI endpoints |
| **Security Headers** | Helmet.js | ✅ Implemented | Add explicit CSP policy |
| **Input Validation** | Zod (to be added) | 🔧 Planned | All API endpoints need schema validation |
| **CSRF Protection** | Double-submit cookie | 🔧 Planned | Required once switching to cookie-based JWT |
| **GitHub API Backoff** | Exponential retry | 🔧 Planned | Prevents sync failures at rate limit |
| **Audit Logging** | Structured JSON logs | 🔧 Planned | Required for sensitive operations |
| **Data Retention** | TTL on PREvent collection | 🔧 Planned | Prevent unbounded growth |
| **Database Indexing** | Compound indexes on orgId, state, jiraIssueKey | 🔧 Planned | Critical for query performance at scale |

---

## 14. PERFORMANCE & SCALABILITY TARGETS

| SLA | Target | Rationale |
|-----|--------|-----------|
| **PR Risk Assessment Latency** | < 5 seconds | Should appear within one GitHub page refresh |
| **Bot Comment Posting** | < 10 seconds | Must appear before reviewer opens the PR |
| **Dashboard Page Load** | < 1 second | Web UX expectations; pre-computed snapshots help |
| **API Response Time (P99)** | < 500ms | Real-time dashboard interactions |
| **Gemini Risk Call** | < 3 seconds | Primary bottleneck in the pipeline |
| **Neo4j Blast Radius Query** | < 500ms | Graph traversal with depth limit of 3 hops |
| **Socket.IO Event Delivery** | < 200ms | Live update feel |
| **GitHub API Rate Limit** | 5,000 req/hour | Managed via exponential backoff + queue pacing |
| **Concurrent Org Users** | 100 simultaneous | Socket.IO org-room architecture scales linearly |
| **Throughput** | 500 PRs/hour | BullMQ horizontal scaling |

### Caching Strategy

| Data | Cache Key | TTL | Rationale |
|------|-----------|-----|-----------|
| Risk analysis result | `risk:{prId}` | 1 hour | Re-analysis on push, not on read |
| Dashboard metric snapshot | `snapshot:{orgId}:{date}` | 24 hours | Recomputed nightly |
| Neo4j blast radius | `blast:{repoId}:{commitSha}` | 6 hours | Dependency graph changes rarely |
| Gemini reviewer suggestion | `reviewers:{prId}` | 30 minutes | Reviewer availability changes |
| GitHub repo list | `repos:{userId}` | 15 minutes | Avoid repeated Octokit calls |

---

## 15. DEPLOYMENT ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION INFRASTRUCTURE                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─ Node.js Backend ──────────────────────────────────────────────┐  │
│  │  Docker container — 2 CPU, 2 GB RAM, replicas: 2–4 (autoscale) │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─ Python Risk Sidecar ──────────────────────────────────────────┐  │
│  │  Docker container — 1 CPU, 1 GB RAM, replicas: 1–2             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─ Frontend (Static) ────────────────────────────────────────────┐  │
│  │  Vite production build → CDN (Cloudflare / Vercel)             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─ BullMQ Workers ───────────────────────────────────────────────┐  │
│  │  Separate process — scales independently from API              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  External Managed Services                                            │
│  ├─ MongoDB Atlas         (100 GB, daily backups, replica set)       │
│  ├─ Neo4j AuraDB          (managed graph database)                   │
│  ├─ Redis Cloud           (16 GB, BullMQ + cache)                    │
│  └─ Sentry               (error + incident tracking)                │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  CI/CD (GitHub Actions)                                               │
│  ├─ On PR → lint, type-check, unit tests                             │
│  ├─ On merge to main → build Docker images, run integration tests    │
│  └─ On release tag → deploy to production (blue-green)               │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Environment Configuration

```
Production:   MongoDB Atlas + Neo4j AuraDB + Redis Cloud + Sentry
Staging:      Same managed services, separate cluster
Development:  docker-compose.yml (MongoDB + Neo4j + Redis all local)
```

---

## 16. IMPLEMENTATION ROADMAP

### Phase 1 — Stabilise & Harden MVP (Weeks 1–3)
*Goal: Make the existing PRSentinel codebase production-safe*

- Add database indexes on `orgId`, `state`, `jiraIssueKey`, `mergedAt` (1 hour, 10–50x query speedup)
- Migrate JWT from localStorage to httpOnly Secure cookies (4 hours)
- Add Zod schema validation on all API routes (8 hours)
- Add GitHub API exponential backoff + retry logic (6 hours)
- Add structured JSON logging (3 hours)
- Implement idempotent sync (no duplicate PREvents on re-run) (8 hours)
- Set TTL on PREvent collection (prevent unbounded growth) (2 hours)
- Add React Error Boundaries to prevent full-app crashes (4 hours)

**Milestone:** PRSentinel ready for beta deployment

---

### Phase 2 — Risk Intelligence Engine (Weeks 4–7)
*Goal: Core AI risk scoring and GitHub bot posting*

- Build Python FastAPI sidecar service with static analysis (radon, bandit, semgrep) (1 week)
- Integrate Gemini structured risk scoring call with JSON schema enforcement (3 days)
- Add `riskQueue` BullMQ job in Node.js backend (2 days)
- Add `RiskAnalysis` and `PROutcome` MongoDB models (1 day)
- Implement GitHub bot comment posting via Octokit (2 days)
- Implement GitHub label application and reviewer request via Octokit (1 day)
- Add `/api/risk/:prId` and `/api/risk/history` routes (2 days)
- Add Redis caching for risk analysis results (1 day)

**Milestone:** Bot posting risk scores on every PR; risk scores visible in dashboard

---

### Phase 3 — Graph Intelligence & Advanced Visualizations (Weeks 8–11)
*Goal: Blast radius, dependency graph, full risk dashboard*

- Activate Neo4j: define node/edge schema for file dependency graph (3 days)
- Build Neo4j ingestion pipeline (parse import statements from PR diffs → write nodes/edges) (1 week)
- Implement blast radius query endpoint (`/api/heatmap/blast-radius/:prId`) (2 days)
- Build PR Risk Detail page (`/risk/:prId`) with all 5 panels (2 weeks):
  - Blast Radius Heatmap (D3.js force graph)
  - Complexity & Churn Trends (Recharts line chart)
  - Vulnerability Radar Chart (Recharts radar)
  - XAI Panel (feature breakdown + similar PRs)
  - Annotated Code Diff viewer
- Build `/risk` page (org-level risk queue + trend chart) (3 days)

**Milestone:** Full risk dashboard live; reviewer can deep-dive any PR

---

### Phase 4 — Continuous Learning & Sprint Tools (Weeks 12–16)
*Goal: Post-merge outcome tracking; complete sprint tooling*

- Build `outcomeQueue` job: query Sentry 48h post-merge, label PROutcome (3 days)
- Add manual outcome override endpoint (reviewer can correct model) (1 day)
- Implement reviewer capacity management in auto-assign (prevent overloading top reviewers) (2 days)
- Add multi-repository dashboard aggregation (cross-repo insights on main dashboard) (3 days)

**Retrospective System (2 weeks):**
- Build `Sprint` and `ActionItem` MongoDB models + all retrospective API routes (3 days)
- Build Sprint List page with health trend indicator and sprint comparison panel (3 days)
- Build Sprint Detail page: metrics snapshot, AI summary (Gemini call with editable output), action item kanban board (5 days)
- Implement action item carry-forward logic (open items auto-appear on next sprint) (1 day)
- Build sprint PDF export (2 days)
- Wire `useRetrospectiveStore` + Socket.IO `retrospective:updated` event (1 day)

**Testing & Production Hardening:**
- Add E2E tests (Playwright) for critical user flows: PR risk flow, retrospective creation, reviewer assignment (2 weeks)
- Add CI/CD pipeline (GitHub Actions: lint → test → build → deploy) (3 days)
- Add monitoring and alerting (Sentry dashboards + uptime checks) (2 days)

**Milestone:** Full platform in production; retrospective loop closes the feedback cycle

---

## 17. SUCCESS METRICS & KPIs

### Platform Health

| KPI | Target |
|-----|--------|
| **Risk Assessment Latency** | < 5 seconds (P95) |
| **Bot Comment Success Rate** | > 99% |
| **Dashboard Load Time** | < 1 second |
| **API Error Rate** | < 0.5% |
| **Test Coverage** | > 80% (backend + frontend) |
| **Uptime** | > 99.5% |

### AI Risk Model Quality

| KPI | Target | Description |
|-----|--------|-------------|
| **Risk Score Precision** | > 85% | Of PRs labelled HIGH, how many actually had issues? |
| **Risk Score Recall** | > 80% | Of PRs that caused incidents, how many were caught? |
| **False Positive Rate** | < 15% | Safe PRs incorrectly flagged as HIGH |
| **False Negative Rate** | < 10% | Risky PRs incorrectly marked LOW |
| **Reviewer Routing Accuracy** | > 80% | Reviewer agrees they were the right person to review |

### Product Impact

| KPI | Target | Measurement |
|-----|--------|-------------|
| **Production Incident Rate** | −35–50% | Post-merge bugs vs. baseline period |
| **Average Review Cycle Time** | −20–30% | For low-risk fast-tracked PRs |
| **Reviewer Efficiency** | +25–40% | High-value reviews per reviewer per week |
| **PR Stagnation Rate** | −40% | PRs stagnating > 48h without reviewer |
| **Knowledge Silo Score** | Improving trend | Fewer single-reviewer domains over time |
| **Team Adoption** | > 80% of org members active weekly | |
| **Action Item Completion Rate** | > 70% closed within sprint | Items closed vs. created per sprint |
| **Sprint Health Score Trend** | Improving or stable over 3 sprints | Computed health score trajectory |
| **Retrospective Engagement** | > 90% of sprints have a closed retrospective | Sprints with AI summary + at least 1 action item |

---

## 18. RISK ASSESSMENT & MITIGATION

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Gemini quota exhaustion** | Medium | High | Token budget monitoring; fallback to heuristic-only scoring |
| **GitHub API rate limit** | Medium | High | Exponential backoff; BullMQ rate-limited job pacing |
| **Firebase auth outage** | Low | Critical | JWT fallback mode; session caching |
| **MongoDB connection loss** | Low | Critical | Mongoose connection pooling; Atlas replica set |
| **Redis unavailability** | Medium | Medium | In-memory queue fallback; BullMQ job persistence |
| **Neo4j disconnection** | Low | Medium | Blast radius falls back to static file count; graceful degradation |
| **Risk model false positives** | High | Medium | Feedback loop; reviewer can manually correct; model prompt refinement |
| **Risk model false negatives** | Medium | High | Conservative scoring for high-churn modules; post-merge monitoring |
| **PR diff too large for Gemini** | Medium | Low | Truncate to 8,000 tokens; summarize large diffs before analysis |
| **Jira token expiration** | Medium | Low | Auto-detect expiry; prompt user for re-auth; graceful degradation |
| **XSS via PR content** | Low | High | React's default escaping; explicit sanitization for rendered diffs |
| **PAT leakage** | Low | Critical | Migrate from `.env` to HashiCorp Vault; encrypt at rest (Cryptr) |

---

## 19. GLOSSARY

| Term | Definition |
|------|-----------|
| **Blast Radius** | The number of downstream services, files, or modules that are affected by changes in a given PR, determined by traversing the code dependency graph |
| **Churn Rate** | The frequency with which a file has been modified over time; high churn often correlates with complexity and fragility |
| **Cyclomatic Complexity** | A measure of the number of linearly independent paths through a piece of code; higher values indicate more complex logic |
| **Stall Reason** | The classified reason a PR has stopped progressing: NO_REVIEWER, CHURNING, COMPLEX_IN_REVIEW, WAITING_CI, or BLOCKED_DEPENDENCY |
| **Risk Score** | A 0–10 numerical rating of the probability that a PR will cause production issues, derived from static analysis, LLM evaluation, and blast radius |
| **Radar Dimensions** | The four axes of the Vulnerability Radar: Dependency Risk, Logic Risk, Data Exposure, Testing Coverage |
| **XAI (Explainable AI)** | The practice of making AI model decisions human-readable; in PRSentinel, this means showing which specific features drove the risk score |
| **PROutcome** | A post-merge label recording whether a PR was SAFE (no issues), REGRESSION (caused a bug), or PREVENTED (fixed an existing issue) |
| **Knowledge Silo** | A state where a critical area of the codebase is only reviewed or understood by a single contributor |
| **Rubber Stamper** | A reviewer who approves PRs without substantive comments or change requests, as detected by the Knowledge Heatmap |
| **BullMQ** | A Redis-backed job queue used to process GitHub webhook events, risk analysis jobs, and metric snapshots asynchronously |
| **Telemetry** | Behavioral data about how a team works — cycle time, throughput, review latency, churn — collected passively from GitHub activity |
| **Fast-Track** | A GitHub label applied by the PRSentinel bot to low-risk PRs (score 0–3), signalling that a quick review is sufficient |
| **Sprint** | A time-boxed development period (typically 1–2 weeks) tracked as a structured record in PRSentinel, with auto-populated metrics, an AI-generated summary, and linked action items |
| **Action Item** | A discrete improvement task created during a sprint retrospective, assigned to a contributor, tracked across sprints until closed, and validated against the metric it was intended to improve |
| **Health Score** | A 0–10 rating computed for each closed sprint based on cycle time, churn, stagnation rate, and average risk score relative to the previous sprint |
| **Carry-Forward** | An action item that was not closed within its original sprint and is automatically surfaced on the next sprint's retrospective with an overdue badge |

---

*PRSentinel — Engineering Intelligence Platform*
*Document Version: 1.1 | Status: Active Development | Last Updated: May 2, 2026*
