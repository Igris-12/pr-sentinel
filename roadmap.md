# PRSentinel Strategic Roadmap

This roadmap prioritizes the transition from **DevDeck** to **PRSentinel** based on two axes: **Significance to the Application** (Value/Impact) and **Implementation Complexity** (Effort/Technical Difficulty).

---

## 🚀 1. High Significance + High Complexity
*The "Big Bets" — Core intelligence features that define PRSentinel's value proposition.*

- **AI Risk Intelligence Engine:**
    - Develop the Python FastAPI sidecar for static analysis.
    - Implement the `riskQueue` worker to coordinate between Sidecar, Gemini, and GitHub.
    - Build the 5-panel **PR Risk Detail** view (Blast Radius, Complexity, Radar, XAI, Diff).
- **Graph Intelligence:**
    - Build the Dependency Ingestion parser to extract imports from diffs.
    - Implement real-time Neo4j graph updates and Blast Radius visualization.
- **System Backbone:**
    - Restore Redis & BullMQ infrastructure for async job orchestration.
- **Verification:**
    - Achieve >80% code coverage through a comprehensive Automated Test Suite.

---

## ⚡ 2. High Significance + Low Complexity
*The "Quick Wins" — Critical hardening and foundational steps with high immediate impact.*

- **Data Foundations:**
    - Implement critical **Database Indexes** (Compound indexes on `PullRequest` and `PREvent`).
    - Define and implement MongoDB schemas for `RiskAnalysis`, `PROutcome`, `Sprint`, and `ActionItem`.
- **Security Hardening:**
    - **JWT Security Migration:** Move tokens to `httpOnly` Secure cookies.
    - **Octokit Resilience:** Add exponential backoff/retry logic to GitHub API calls.
- **Visibility:**
    - **Risk Queue:** Build the organization-wide high-risk PR monitor.
    - **Sentry Integration:** Connect for regression monitoring and automated outcome labeling.
- **Reliability:**
    - **Idempotent Sync:** Refactor `syncGitHub.js` to prevent duplicate data entry.

---

## 🏛️ 3. Medium/Low Significance + High Complexity
*The "Strategic Investments" — Important features that require significant effort but are less central to core risk scoring.*

- **Retrospective Intelligence:**
    - Implement the **Sprint Metrics Job** for complex KPI aggregation.
    - Build the **AI Narrative Generator** (Gemini prompt engineering for sprint summaries).
- **Advanced Verification:**
    - Implement **E2E Integration Tests** (Playwright) for the full "Webhook -> Analysis -> Bot" flow.
- **Infrastructure:**
    - Neo4j Graph Database activation and node/edge schema definition.
- **Integration:**
    - **Jira Hardening:** Implement robust token rotation and regex-based correlation.

---

## 🛠️ 4. Medium/Low Significance + Low Complexity
*The "Maintenance & Polish" — Essential stability and UI improvements.*

- **Observability:**
    - Standardize **Structured JSON Logging** using `winston`.
    - Implement the **Audit Logging** trail for sensitive operations.
- **UX & Stability:**
    - Implement **React Error Boundaries** to prevent frontend crashes.
    - Build the **Unified Heatmap Hub** (Merging team roster with collaboration graph).
- **Data Hygiene:**
    - Implement **TTL (Time-To-Live)** on `PREvent` logs to manage database growth.
- **Frontend Refinement:**
    - Refine **Developer Scorecards** with new axes (Complexity/Review Quality).
    - Configure the **CI/CD Pipeline** for automated linting and deployment.
