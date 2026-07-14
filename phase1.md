# Phase 1 Summary — Backend Hardening & Data Model Evolution

This document summarizes the core architectural, security, and logic updates implemented during Phase 1 of the PRSentinel platform stabilization.

## 1. Data Model Evolution (Mongoose)

We have significantly evolved the data models to support AI-driven risk intelligence and a more robust retrospective system.

- **PullRequest Model Extensions:**
  - Added `riskScore` (0–10), `riskLabel` (LOW to CRITICAL), and `riskAnalysisId`.
  - Added `botCommentPosted` and `botCommentId` for tracking GitHub bot interactions.
  - Expanded `stallReason` enum to include `WAITING_CI` and `BLOCKED_DEPENDENCY`.
  - Enforced `riskScore` constraints (never null, range 0-10).
- **New Intelligence Models:**
  - `RiskAnalysis.js`: Detailed schema for AI rationale, blast radius data, and radar dimensions.
  - `PROutcome.js`: Tracking post-merge results (SAFE, REGRESSION, PREVENTED) for post-merge validation.
- **Retrospective System Refactor:**
  - Deleted obsolete `Retrospective.js`.
  - `Sprint.js`: New model for sprint-based metrics, AI summaries, and health trends.
  - `ActionItem.js`: New model for longitudinal tracking of improvement tasks.

## 2. Security Hardening

To protect against XSS-based token theft, we migrated sensitive credential storage from the client to the server.

- **JWT Migration:**
  - Moved `accessToken` and `refreshToken` storage from `localStorage` to **httpOnly Secure Cookies**.
  - Updated `auth.js` middleware to prioritize cookie-based authentication.
  - Updated `/auth/firebase`, `/auth/refresh`, and `/auth/logout` routes to manage secure cookies.

## 3. Synchronization & API Resilience

The GitHub synchronization engine (`syncGitHub.js`) was refactored for reliability at scale.

- **Idempotency:**
  - `upsertPR` now explicitly checks for existing `PREvent` logs (opened, merged) to prevent duplicate data on overlapping sync runs.
- **API Resilience:**
  - Integrated `@octokit/plugin-retry`.
  - Implemented **exponential backoff** for 429 (Rate Limit) and 5xx (Server Error) responses.

## 4. Performance Optimization

- **Compound Indexes:**
  - `PullRequest`: Added `(orgId, state)` and `(orgId, stallReason)` for faster dashboard filtering.
  - `PREvent`: Verified `(prId, occurredAt)` for timeline rendering.
  - `Sprint`: Added `(prId, timestamp)` for historical lookups.

## 5. Critical Bug Fixes & Refactoring

- **Broken Imports:** Fixed `backend/routes/ai.js` after the removal of `Retrospective.js`.
- **Endpoint Typos:** Fixed a critical 404 in `ConnectPage.tsx` (corrected `/aps-repo` to `/add-repo`).
- **Test Infrastructure:** Established a Node.js-based test suite (`backend/tests/models.test.js`) and satisfied Python `pytest` requirements.

---
*Status: Phase 1 Completed & Verified*
