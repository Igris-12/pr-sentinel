# PRSentinel — Engineering Intelligence Platform
## College Capstone Live Demonstration Script & Navigation Guide

This document provides the complete, chronological spoken script and live application navigation guide for presenting **PRSentinel** as a college capstone project. 

### Presentation Design Principles
1. **Academic & Agile Learning Focus:** Rather than heavy corporate ROI/industry sales pitch metrics, the introduction highlights how your team built a real-world developer tool while mastering modern software engineering methodologies (Agile sprints, continuous integration, multi-tier system architecture, and real-time event-driven programming).
2. **Live Application Navigation:** There are no slides. The presentation is structured around a live walkthrough of the **PRSentinel web interfaces** (`/dashboard`, `/pr-health`, `/risk`, `/scorecard`, `/ai`, `/retrospective`) and an actual **GitHub Pull Request thread** where the AI bot operates.
3. **Architectural Transparency:** Evaluators appreciate technical honesty above all else. The script explicitly demonstrates our live functional pipeline while clearly explaining where our system design (`Architecture.md`) extends into our planned phase-two roadmap (e.g., Neo4j microservice dependency traversal and deep static AST scanning).

---

## 1. Presenter Roles & Focus Areas


| Speaker | Role Title | Focus Area & Live Demo Responsibility |
| :--- | :--- | :--- |
| **Speaker 1 (Speaker A)** | **Documentation, UI Design & Agile Process Lead** | **Project Origin, Agile Methodology & UI Design System:** Introduces the motivation of building a modern developer tool, our Agile development journey, UI/UX design philosophy (Glassmorphism, Tailwind CSS, component modularity), and navigates the live **Landing Page (`/`)** and **GitHub Connection (`/connect`)** onboarding flow. |
| **Speaker 2 (Speaker B)** | **Backend Telemetry & Real-Time Platform Engineer** | **Event Ingestion & Real-Time Dashboard:** Explains how PRSentinel connects non-invasively to GitHub, processes webhook payloads asynchronously (`Express`, `BullMQ`, `MongoDB`), synchronizes live data (`Socket.IO`), and demonstrates the **Main Analytics Hub (`/dashboard`)** and **Cycle Time Breakdown (`/cycle-time`)**. |
| **Speaker 3 (Speaker C)** | **AI & Risk Intelligence Architect** | **Proactive Code Analysis & Automated GitHub Bot:** Demonstrates the live automated pull request workflow on GitHub. Explains the multi-stage evaluation inside the **Python FastAPI Sidecar (`radon` static complexity + Gemini 2.0 Flash structured JSON)**, and transparently details what is live versus our architectural vision for graph dependency traversal (`Neo4j`) and AST scanning (`bandit`/`semgrep`). |
| **Speaker 4 (Speaker D)** | **Interactive Analytics & UX Lead** | **Interactive Visualizations & Agile Sprint Co-Pilot:** Demonstrates the interactive D3.js and TanStack Query interfaces: the **Stagnation Bubble Matrix (`/pr-health`)**, **PR Risk Detail Page (`/risk/:prId`)**, **Developer Scorecard (`/scorecard`)**, and the stateful **AI Assistant & Agile Retrospective Suite (`/ai`, `/retrospective`)**. |

---

## 2. Complete Live Demonstration Script

### Segment 1: Project Origin, Agile Methodology & UI Design System
**Speaker 1 (Speaker A — Documentation, UI Design & Agile Process Lead)**

> **[LIVE DEMO ACTION: Open the browser and display the PRSentinel Landing Page (`/`)]**

**Speaker 1:**
> "Good morning/afternoon respected faculty members, evaluators, and friends. Today, our team is excited to demonstrate our capstone project: **PRSentinel — an AI-powered Engineering Intelligence Platform**.
>
> When we started designing our capstone at the beginning of the semester, our primary objective wasn't just to write code; we wanted to experience the full **industrial software development lifecycle**. We worked as an Agile team, running two-week sprints, managing backlog stories, and conducting formal code reviews. 
>
> During our own early sprints, we encountered the exact challenges that engineering teams face everywhere:
> 1. **Code Review Bottlenecks:** When a pull request had hundreds of lines across multiple files, reviewing it took hours, and small syntax changes were often treated with the same urgency as modifications to critical backend modules.
> 2. **Sprint Stagnation:** Pull requests would sit open for days simply because no specific reviewer was assigned, causing sprint velocity to drop right before our sprint demos.
> 3. **Subjective Retrospectives:** When we conducted our end-of-sprint retrospectives, we had to rely on memory rather than concrete data about what slowed our team down.
>
> We built **PRSentinel** to solve these exact problems. It is a dual-tier platform that works right alongside developers inside GitHub while providing engineering leads with a real-time, explainable analytics command center.
>
> From a UI and UX design perspective, we wanted the application to feel modern, responsive, and intuitive. As you can see here on our landing page, we built the interface using **React 19, TypeScript, and Vite**, implementing a curated **glassmorphic design system using Tailwind CSS**. We focused heavily on visual hierarchy and smooth micro-animations so that complex engineering data is clean and easy to read.

> **[LIVE DEMO ACTION: Click the 'Connect' / 'Get Started' button and navigate to the Connect Page (`/connect`)]**

**Speaker 1:**
> "When a developer or team lead first adopts PRSentinel, onboarding takes less than a minute. Right here on the Connect page, an organization authenticates via OAuth and inputs their GitHub Personal Access Token. Our backend encrypts this token using `Cryptr` AES-256 encryption and registers a webhook directly with the repository.
>
> From that moment on, PRSentinel silently listens to pull request events without requiring developers to leave their terminal or GitHub workflow.
>
> To show you exactly how our backend captures these events and synchronizes data in real time across our application, I will hand it over to [Speaker 2's Name]."

---

### Segment 2: Backend Telemetry Ingestion & Real-Time Dashboard Walkthrough
**Speaker 2 (Speaker B — Backend Telemetry & Real-Time Platform Engineer)**

> **[LIVE DEMO ACTION: Log into the live workspace and display the Main Analytics Dashboard (`/dashboard`)]**

**Speaker 2:**
> "Thank you, [Speaker 1's Name]. To power an analytics dashboard that updates instantaneously, we designed our backend as an event-driven, multi-tier Node.js and Express architecture connected to a MongoDB document store and a real-time Socket.IO gateway.
>
> Let’s walk through what happens under the hood when a developer pushes a code commit or opens a pull request on GitHub:
>
> First, GitHub sends a JSON payload to our `/api/webhooks/github` endpoint. Our Express server immediately verifies the HMAC cryptographic signature to guarantee the request is genuine. To ensure our API responds to GitHub within milliseconds—even during heavy commit activity—we enqueue the event into **BullMQ**, our asynchronous job processing system backed by Redis.
>
> Next, our background worker processes the payload and performs two concurrent operations:
> 1. **Telemetry Enrichment:** It queries GitHub via Octokit to calculate exact behavioral metrics—measuring how many hours the PR spent in draft status, review latency, code churn rates, and our proprietary formula for **stagnation probability**. This enriched data is upserted into our MongoDB collections: `PullRequest`, `PREvent`, and time-series `MetricSnapshot`.
> 2. **Real-Time WebSocket Emission:** Simultaneously, our server emits a `pr:updated` or `metrics:updated` event over **Socket.IO** directly to the organization's active room.

> **[LIVE DEMO ACTION: Point to the KPI Cards (`Average Cycle Time`, `Throughput`, `Active WIP`, `Churn Rate`) and hover over the Recharts Time-Series Graph on the Dashboard (`/dashboard`)]**

**Speaker 2:**
> "As you can see right now on our live dashboard, because our frontend TanStack Query hooks listen to these Socket.IO events, these KPI cards and charts refresh live with zero page reloading.
>
> Here at the top, we see our team's **Average Cycle Time**, **PR Throughput**, **Active Work-in-Progress Count**, and **Code Churn Rate** across 30, 60, or 90-day timeframes. Below our KPI cards, we use **Recharts** to render our daily merged pull request trends and our Work-in-Progress distribution gauge.

> **[LIVE DEMO ACTION: Click the 'Cycle Time' link on the sidebar to navigate to (`/cycle-time`)]**

**Speaker 2:**
> "If we navigate to our **Cycle Time Breakdown (`/cycle-time`)**, we can diagnose exactly where time is being spent—breaking down the hours from initial draft creation, to first reviewer comment, to final merge approval.
>
> Now, as part of our architectural transparency, I want to highlight an important engineering decision we made during our capstone development:
> While our core architecture (`Architecture.md`) uses standalone Redis workers for full multi-node horizontal scaling, for our current live environment we implemented an intelligent inline fallback inside our `riskQueue.js` service that processes jobs directly if a dedicated Redis instance is offline. Furthermore, while our `PREvent` schema uses compound indexing (`{ prId: 1, occurredAt: 1 }`) for fast query execution, our phase-two roadmap includes adding MongoDB TTL (`expireAfterSeconds`) indexes and Joi/Zod runtime schema validation across our Express routes.
>
> While my system tracks retrospective telemetry and velocity, our AI engine operates simultaneously to inspect the actual code diff. To walk you through our live automated pull request evaluation on GitHub, I’ll turn it over to [Speaker 3's Name]."

---

### Segment 3: Proactive Code Risk Analysis & Automated GitHub Bot
**Speaker 3 (Speaker C — AI & Risk Intelligence Architect)**

> **[LIVE DEMO ACTION: Switch browser tab from the PRSentinel web app directly to a live GitHub Repository showing an open Pull Request thread with the automated PRSentinel Bot comment]**

**Speaker 3:**
> "Thank you, [Speaker 2's Name]. While historical metrics tell us how fast we are coding, they don't tell us *how risky* that code is. Whenever a pull request is opened or updated, PRSentinel executes an asynchronous AI risk evaluation in **under 5 seconds**.
>
> Here on GitHub, you can see the direct result of our pipeline: our automated **PRSentinel Bot** has posted a structured risk assessment right inside the pull request discussion thread.
>
> Let’s examine how our system generated this exact assessment under the hood:
> Because parsing code syntax and running statistical computations can block a Node.js event loop, we built a dedicated microservice: our **Python FastAPI Risk Sidecar (`/analyze`)**.
>
> When our Node.js worker triggers the sidecar, it executes a two-stage evaluation:
>
> First, our **Static Analysis Module** processes the raw git diff. Rather than relying on simple line counts, we execute the Python `radon` static analysis library to compute the **cyclomatic complexity delta** across every modified file. We cross-reference our MongoDB database to check the file's historical **churn rate**—determining whether the developer is modifying stable infrastructure or a historically buggy module.
>
> Second, we package these static metrics alongside the diff and transmit them to our structured large language model engine powered by **Gemini 2.0 Flash**."

> **[LIVE DEMO ACTION: Point out the specific sections inside the live GitHub Bot comment: `Risk Score`, `Vulnerability Radar`, `Rationale`, and `Assigned Reviewers / Labels`]**

**Speaker 3:**
> "To prevent the AI from generating vague or hallucinated responses, our Python sidecar enforces a strict JSON output schema (`_gemini_response_schema()`). We instruct Gemini 2.0 Flash to evaluate the diff across four critical dimensions, which you see reflected here:
> * **Dependency Risk:** Does the change introduce external libraries or alter environment configurations?
> * **Logic Risk:** Does the code introduce deep nested loops or complex branching?
> * **Data Exposure:** Does the change interact with sensitive data fields or authentication layers?
> * **Testing Coverage:** Are these new code paths covered by unit tests?
>
> The engine normalizes these dimensions into a final **Risk Score from 0.0 to 10.0**, accompanied by exact bulleted rationales.
>
> Notice what happened on GitHub: because this pull request scored **7.2 out of 10 (High Risk)**, our bot automatically applied the `🔴 Risk: High` and `Needs Review` labels, and routed review requests to team members who have historical domain ownership of these specific files. Conversely, if a PR scores below **3.0 (Low Risk)**, the bot applies a `🟢 Fast-Track` label, allowing maintainers to approve it in minutes.
>
> To be completely transparent about our implementation audit (`integration_2.md`): today, our live engine computes cyclomatic complexity (`radon`), evaluates Gemini 2.0 Flash structured risk models, and automates GitHub feedback and label routing end-to-end. As outlined in our formal `Architecture.md`, our upcoming phase-two roadmap expands this sidecar by activating **Neo4j graph database queries** (`backend/config/neo4j.js`) to trace multi-repository microservice blast radius dependencies, alongside **Bandit and Semgrep AST static scanners** for deep security vulnerability pattern detection.
>
> To show you how this rich risk data and team collaboration history is visualized on our interactive web interfaces, let me pass the presentation to [Speaker 4's Name]."

---

### Segment 4: Interactive Analytics, Scorecards & Agile Sprint Co-Pilot
**Speaker 4 (Speaker D — Interactive Analytics & UX Lead)**

> **[LIVE DEMO ACTION: Switch browser tab back to the PRSentinel web application and click on 'Stagnation Matrix' / `PRHealthPage` (`/pr-health`) in the navigation bar]**

**Speaker 4:**
> "Thank you, [Speaker 3's Name]. While developers receive automated feedback inside GitHub, engineering leads need visual tools to diagnose team bottlenecks and run data-driven Agile sprints.
>
> Here on our **Stagnation Bubble Matrix (`/pr-health`)**, we implemented an interactive **D3.js force-directed physics simulation** where every open pull request is represented as a floating bubble.
> * The **Size of the bubble** corresponds to the age of the pull request—older PRs physically expand on the screen.
> * The **Color of the bubble** classifies its exact stall reason based on our telemetry heuristics: **Red** indicates `No Reviewer Assigned`, **Orange** highlights `High Churn & Rework`, and **Yellow** flags `Complex Code in Review`.

> **[LIVE DEMO ACTION: Click on one of the large Red floating bubbles (`NO_REVIEWER`) on the matrix to open the side drawer / auto-assign modal]**

**Speaker 4:**
> "When a tech lead notices a large red bubble right before the end of a sprint, clicking it opens our diagnostic panel. Right here, our system recommends available reviewers based on their current open review workload (`reviewerLoadIndex`) and domain familiarity, allowing the lead to assign a reviewer with a single click before sprint velocity drops.

> **[LIVE DEMO ACTION: Navigate to the PR Risk Detail Page (`/risk/:prId`) by clicking 'View Full Analysis' or choosing a PR from the Risk Page (`/risk`)]**

**Speaker 4:**
> "If we navigate to the **PR Risk Detail Page (`/risk/:prId`)** for a specific high-risk pull request, our frontend renders a comprehensive diagnostic dashboard. Here you see our **4-axis Vulnerability Radar Chart**, an **Explainable AI (XAI) feature contribution breakdown**, and an annotated code diff that displays exactly which lines of code triggered Gemini's complexity and data exposure flags.

> **[LIVE DEMO ACTION: Click on 'Scorecards' / `ScorecardPage` (`/scorecard`) in the sidebar navigation]**

**Speaker 4:**
> "Next is our **Developer Growth Scorecard (`/scorecard`)**. I want to strongly emphasize that as an Agile college team, we designed this scorecard to be **comparative, educational, and strictly anti-ranking**. 
> Rather than evaluating engineers with a single simplistic number, we map contributions across a **5-axis radar chart**: *Velocity, Review Quality, Code Complexity, Collaboration, and Thoroughness*. This visual representation allows developers to identify personal strengths and areas where they can mentor peers—for instance, balancing rapid code velocity with thorough code review collaboration.

> **[LIVE DEMO ACTION: Click on 'AI Assistant' / `AIAssistantPage` (`/ai`) or 'Retrospective' / `RetrospectivePage` (`/retrospective`) in the sidebar navigation]**

**Speaker 4:**
> "Finally, to tie our entire capstone project back to industrial Agile development methodologies, we built our **Stateful AI Assistant (`/ai`)** and **Retrospective Suite (`/retrospective`)**.
>
> During a typical Agile sprint review, Scrum Masters spend hours manually compiling metrics. In PRSentinel, our stateful Gemini chat assistant is directly connected to our `MetricSnapshot` MongoDB documents. A tech lead can ask in natural language: *'Why did our cycle time increase during Sprint 3?'* or *'Summarize our team's pull request throughput over the last two weeks.'*
>
> Even better, when navigating to our **Retrospective Page (`/retrospective`)**, our backend automatically generates a comprehensive, data-backed sprint summary. It identifies what went well, highlights where pull requests stalled, and maintains an **Action Item Tracker** (`backend/models/ActionItem.js`) that carries open action items forward from sprint to sprint until the team checks them off. This ensures our Agile retrospectives lead to measurable engineering improvements."

---

### Segment 5: Conclusion & Q&A Transition
**Speaker 1 (Speaker A — Documentation, UI Design & Agile Process Lead)**

> **[LIVE DEMO ACTION: Return to the Main Dashboard (`/dashboard`) or Landing Page (`/`)]**

**Speaker 1:**
> "Thank you, [Speaker 4's Name]. To conclude our capstone demonstration:
> Building **PRSentinel** over this semester has allowed our team to experience what it takes to build a production-grade developer tool following industrial Agile workflows.
>
> * By implementing our **Retrospective Telemetry Engine**, we learned how to ingest real-time webhook events, manage asynchronous queues (`BullMQ`), and broadcast state changes instantly using `Socket.IO`.
> * By building our **Proactive AI Risk Sidecar (`radon` + Gemini 2.0 Flash)**, we gained practical experience uniting static code analysis with structured LLM prompt engineering to automate real-time feedback inside GitHub.
> * And by developing our **Glassmorphic React 19 & D3.js Interface**, we learned how to design interactive, educational visualizations that turn raw data into actionable developer insights.
>
> We are extremely proud of what we have built and the architectural foundation we have established for future extensions. Thank you very much for your time and guidance throughout the semester. We would now be delighted to answer any questions about our system architecture, technical implementation, or development methodology."

---

## 3. Quick Presenter Checklist Before Demo

1. **Environment Check:** Ensure the local Node.js (`backend/server.js`), Python FastAPI sidecar (`backend/main.py`), and Vite frontend dev server (`npm run dev`) are all running and connected without console errors.
2. **Browser Tabs Prepared:**
   - **Tab 1:** PRSentinel Landing Page (`/`) and Dashboard (`/dashboard`).
   - **Tab 2:** Live GitHub Repository pull request showing the `🤖 PRSentinel Risk Assessment` bot comment and risk labels.
   - **Tab 3:** Stagnation Bubble Matrix (`/pr-health`) and Developer Scorecard (`/scorecard`).
   - **Tab 4:** AI Assistant (`/ai`) or Retrospective page (`/retrospective`) ready for a quick live query demonstration.
3. **Smooth Transitions:** When speaking, do not rush. Let the audience absorb the live UI interaction before explaining the underlying backend or AI mechanism.
