# PRSentinel Integration Checklist

This checklist outlines the steps required to transition the current **DevDeck** platform into the target **PRSentinel** Engineering Intelligence Platform, addressing technical debt identified in the audit (`report.md`) and implementing new features from the project specification (`plan.md`).

## 1. Rebranding & Identity
- [x] **String Replacement:** Rename "DevDeck" to "PRSentinel" across all source files, comments, and documentation.
- [x] **Metadata Update:** Update `name` and `description` in root, backend, and frontend `package.json` files.
- [x] **Environment Configuration:** Update default database names (e.g., `devdeck` -> `prsentinel`) and secret keys in `.env` templates.
- [x] **Docker Orchestration:** Rename containers and update service labels in `docker-compose.yml`.
- [x] **Frontend State:** Update local storage keys (e.g., `devdeck_token` -> `prsentinel_token`) and Zustand store names.
- [x] **Visual Identity:** Update logos, favicon, and all UI text mentions of "DevDeck".

## 2. Infrastructure & Security Hardening
- [ ] **Redis & BullMQ Restoration:** Re-enable the background job system. Restore `webhookQueue.js` and implement workers for `riskQueue`, `telemetryQueue`, and `snapshotQueue`.
- [ ] **Database Indexing:** Implement critical compound indexes on `PullRequest` (`orgId`, `state`, `jiraIssueKey`, `mergedAt`) and `PREvent` collections.
- [ ] **JWT Security Migration:** Move JWT storage from `localStorage` to `httpOnly` Secure cookies to mitigate XSS risks.
- [ ] **Schema Validation:** Implement `Zod` or `Joi` validation for all API request bodies and query parameters.
- [ ] **Octokit Resilience:** Add exponential backoff and retry logic for GitHub API calls to handle rate limiting gracefully.
- [ ] **Structured Logging:** Standardize all backend logs to JSON format using `winston` for better observability.
- [ ] **Audit Logging:** Implement a dedicated audit trail for sensitive operations (PAT updates, role changes).
- [ ] **Idempotent Sync:** Refactor `syncGitHub.js` to ensure safe re-runs without duplicate `PREvent` entries.
- [ ] **React Error Boundaries:** Implement global and component-level boundaries in the frontend to prevent full-app crashes.
- [ ] **Data Retention:** Implement TTL (Time-To-Live) on `PREvent` logs to prevent unbounded database growth.
- [ ] **Jira Hardening:** Implement token rotation and improve ticket-to-PR regex robustness for reliable issue correlation.

## 3. Data Model Extensions (MongoDB)
- [ ] **RiskAnalysis Model:** Implement schema for storing AI risk scores, rationales, radar dimensions, and blast radius snapshots.
- [ ] **PROutcome Model:** Implement schema for post-merge outcome tracking (SAFE, REGRESSION, PREVENTED).
- [ ] **Sprint Model:** Upgrade the existing `Retrospective` model to a full `Sprint` entity with metrics and AI summaries.
- [ ] **ActionItem Model:** Create schema for longitudinal tracking of improvement tasks across sprints.

## 4. AI Risk Intelligence Engine
- [ ] **Python Sidecar Service:** Develop the FastAPI sidecar for static analysis (`radon`, `bandit`, `semgrep`).
- [ ] **Gemini Structured Output:** Refactor LLM calls to use structured JSON for consistent risk assessments.
- [ ] **Risk Analysis Pipeline:** Implement the `riskQueue` worker to coordinate between the sidecar, Gemini, and GitHub.
- [ ] **Automated Bot Comments:** Enable automatic posting of risk assessment summaries to GitHub PR threads.
- [ ] **Risk-Based Routing:** Update the `autoAssign` logic to prioritize reviewers based on AI-suggested risk levels.

## 5. Graph Intelligence & Heatmaps
- [ ] **Neo4j Integration:** Activate the Neo4j graph database and define the node/edge schema for code dependencies.
- [ ] **Dependency Ingestion:** Build a parser to extract imports from PR diffs and update the Neo4j graph in real-time.
- [ ] **Blast Radius Visualization:** Implement the D3.js interactive graph for impact analysis on the PR detail page.
- [ ] **Unified Heatmap Hub:** Merge the `/team` roster into a new tabbed `/heatmap` interface.

## 6. Retrospective System
- [ ] **Sprint Metrics Job:** Implement a background task to aggregate KPI snapshots for sprint date ranges.
- [ ] **AI Narrative Generator:** Build the Gemini prompt logic for synthesizing sprint successes and struggles.
- [ ] **Action Item Tracking:** Create the Kanban-style management interface for sprint action items.
- [ ] **Sprint Comparison:** Implement the side-by-side metric comparison view for longitudinal health tracking.

## 7. Frontend UI Expansion
- [ ] **Risk Queue:** Build the `/risk` page to monitor high-risk PRs across the organization.
- [ ] **PR Risk Detail:** Implement the 5-panel deep-dive view for individual Pull Requests.
- [ ] **Retrospective Dashboard:** Build the chronological sprint list and detail views.
- [ ] **Developer Scorecards:** Refine the radar charts to include "Complexity Handled" and "Review Quality" axes.

## 8. Verification & QA
- [ ] **Automated Test Suite:** Achieve >80% coverage for backend routes and core frontend utilities.
- [ ] **E2E Integration Tests:** Implement Playwright tests for the critical "Webhook -> Analysis -> Bot Comment" flow.
- [ ] **CI/CD Pipeline:** Configure GitHub Actions for automated linting, testing, and deployment previews.
