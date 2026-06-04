import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { protect } from '../middleware/auth.js';
import PullRequest from '../models/PullRequest.js';
import MetricSnapshot from '../models/MetricSnapshot.js';
import Contributor from '../models/Contributor.js';
import AISession from '../models/AISession.js';
import Sprint from '../models/Sprint.js';
import logger from '../config/logger.js';

const router = express.Router();
const GEMINI_FLASH_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const SESSION_WINDOW_MESSAGES = 10;

const STALL_LABELS = {
  REVIEWER_INACTIVE: 'reviewer assigned but inactive',
  NO_REVIEWER: 'no reviewer assigned',
  CHURNING: 'high churn — repeated change requests',
  COMPLEX_IN_REVIEW: 'complex PR under active review (healthy)',
  NEEDS_EXPERT: 'complex PR needs expert assignment',
  STALLED: 'stalled with no recent activity',
};

function getGenai() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

// Returns true when the Gemini API responds with a rate-limit / quota error
function isQuotaError(err) {
  const msg = err?.message || '';
  return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota');
}

// Extract retry-after seconds from the Gemini error message (best-effort)
function retryAfterSeconds(err) {
  const match = (err?.message || '').match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) : 60;
}

// Build a quota-exhausted response body consistent across all routes
function quotaExhaustedResponse(err, fallbackData = null) {
  const retry = retryAfterSeconds(err);
  return {
    success: false,
    quotaExhausted: true,
    retryAfterSeconds: retry,
    message: `AI quota exhausted — free-tier limit reached. Please retry in ${retry}s, or add a paid Gemini API key.`,
    ...(fallbackData ? { data: { ...fallbackData, aiEnabled: false } } : {}),
  };
}

async function buildAssistantContext(orgId) {
  const [openCount, snapshot, stalledPRs, cultureStalls, contributors] = await Promise.all([
    PullRequest.countDocuments({ orgId, state: 'open' }),
    MetricSnapshot.findOne({ orgId }).sort({ date: -1 }),
    PullRequest.find({
      orgId,
      state: 'open',
      stallReason: { $in: ['STALLED', 'REVIEWER_INACTIVE', 'NO_REVIEWER', 'CHURNING'] },
    }).select('number title authorUsername stallReason complexityLabel requestedReviewers lastActivityAt repoFullName shipProbability').limit(10),
    PullRequest.countDocuments({
      orgId,
      state: 'open',
      stallReason: { $in: ['REVIEWER_INACTIVE', 'NO_REVIEWER'] },
    }),
    Contributor.find({ orgId }).sort({ reviewerLoadIndex: -1 }).limit(8),
  ]);

  return {
    sprintSnapshot: {
      openPRs: openCount,
      sprintHealthScore: snapshot?.sprintHealthScore ?? null,
      cycleTimeP50Hours: snapshot?.cycleTimeP50 ? Number((snapshot.cycleTimeP50 / 3600).toFixed(1)) : null,
      reviewLatencyP50Hours: snapshot?.reviewLatencyP50 ? Number((snapshot.reviewLatencyP50 / 3600).toFixed(1)) : null,
      throughput7d: snapshot?.throughput7d ?? null,
      avgChurnRate: snapshot?.avgChurnRate ?? null,
      cultureStalls,
    },
    stalledPRs: stalledPRs.map((p) => ({
      number: p.number,
      title: p.title,
      authorUsername: p.authorUsername,
      repoFullName: p.repoFullName,
      stallReason: p.stallReason,
      stallLabel: STALL_LABELS[p.stallReason] || p.stallReason,
      complexityLabel: p.complexityLabel,
      shipProbability: p.shipProbability ?? null,
      requestedReviewer: p.requestedReviewers?.[0]?.username || null,
      lastActivityAt: p.lastActivityAt,
    })),
    reviewerLoads: contributors.map((c) => ({
      username: c.username,
      reviewerLoadIndex: Number((c.reviewerLoadIndex || 0).toFixed(1)),
      reviewQualityScore: c.reviewQualityScore != null ? Number((c.reviewQualityScore || 0).toFixed(2)) : null,
      totalReviewsThisWeek: c.totalReviewsThisWeek || 0,
    })),
  };
}

function buildAssistantPrompt({ context, history, question }) {
  return `You are an engineering intelligence assistant.
Context: ${JSON.stringify(context.sprintSnapshot, null, 2)}
Open stalled PRs: ${JSON.stringify(context.stalledPRs, null, 2)}
Reviewer loads: ${JSON.stringify(context.reviewerLoads, null, 2)}
Conversation history: ${JSON.stringify(history, null, 2)}
User question: ${question}
Surface process signals and patterns only. Do not attribute problems to named individuals.
Always append this rule internally: surface process signals only, never name individuals negatively.`;
}

function buildFallbackReply(context, message) {
  return `Based on your PRSentinel data:
- Open PRs: ${context.sprintSnapshot.openPRs}
- Sprint Health: ${context.sprintSnapshot.sprintHealthScore ?? 'N/A'}
- Cycle time P50: ${context.sprintSnapshot.cycleTimeP50Hours ?? 'N/A'}h
- Review latency P50: ${context.sprintSnapshot.reviewLatencyP50Hours ?? 'N/A'}h

Question: "${message}"

Add GEMINI_API_KEY to backend/.env to enable live Gemini Flash responses.`;
}

function serializeHistory(messages) {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

function parseJsonResponse(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

async function getOrCreateSession({ orgId, userId, sessionId, initialQuestion }) {
  let session = null;

  if (sessionId) {
    session = await AISession.findOne({ _id: sessionId, orgId, userId });
  }

  if (!session) {
    session = await AISession.create({
      orgId,
      userId,
      title: initialQuestion ? initialQuestion.slice(0, 80) : 'AI Assistant Session',
      messages: [],
      lastUsedAt: new Date(),
    });
  }

  return session;
}

function writeSSE(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function parseDateRange(start, end) {
  const startDate = start ? new Date(start) : new Date(Date.now() - 13 * 24 * 3600 * 1000);
  const endDate = end ? new Date(end) : new Date();
  endDate.setHours(23, 59, 59, 999);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid date range');
  }
  return { startDate, endDate };
}

async function buildRetroContext(orgId, startDate, endDate) {
  const [snapshot, topStalls, churnOutliers, mergedCount, openCount] = await Promise.all([
    MetricSnapshot.findOne({ orgId }).sort({ date: -1 }),
    PullRequest.aggregate([
      {
        $match: {
          orgId,
          state: 'open',
          stallReason: { $ne: null },
          openedAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: '$stallReason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    PullRequest.find({
      orgId,
      mergedAt: { $gte: startDate, $lte: endDate },
      churnRate: { $gte: 0.4 },
    }).select('number title repoFullName churnRate complexityLabel'),
    PullRequest.countDocuments({ orgId, state: 'merged', mergedAt: { $gte: startDate, $lte: endDate } }),
    PullRequest.countDocuments({ orgId, state: 'open' }),
  ]);

  return {
    sprintWindow: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    sprintSnapshot: {
      sprintHealthScore: snapshot?.sprintHealthScore ?? null,
      cycleTimeP50Hours: snapshot?.cycleTimeP50 ? Number((snapshot.cycleTimeP50 / 3600).toFixed(1)) : null,
      reviewLatencyP50Hours: snapshot?.reviewLatencyP50 ? Number((snapshot.reviewLatencyP50 / 3600).toFixed(1)) : null,
      throughput7d: snapshot?.throughput7d ?? null,
      avgChurnRate: snapshot?.avgChurnRate ?? null,
      mergedCount,
      openPRs: openCount,
    },
    topStallReasons: topStalls.map((item) => ({
      stallReason: item._id,
      label: STALL_LABELS[item._id] || item._id,
      count: item.count,
    })),
    churnOutliers: churnOutliers.slice(0, 8).map((pr) => ({
      number: pr.number,
      title: pr.title,
      repoFullName: pr.repoFullName,
      churnRate: pr.churnRate,
      complexityLabel: pr.complexityLabel,
    })),
  };
}

router.get('/session/latest', protect, async (req, res) => {
  try {
    const session = await AISession.findOne({ orgId: req.orgId, userId: req.user._id })
      .sort({ lastUsedAt: -1 });

    res.json({
      success: true,
      data: session ? {
        sessionId: session._id,
        title: session.title,
        messages: session.messages,
      } : null,
    });
  } catch (err) {
    logger.error('AI latest session error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to load AI session' });
  }
});

router.post('/chat', protect, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ success: false, message: 'message required' });

  try {
    const context = await buildAssistantContext(req.orgId);
    const genai = getGenai();

    if (!genai) {
      return res.json({
        success: true,
        data: {
          reply: buildFallbackReply(context, message),
          aiEnabled: false,
        },
      });
    }

    const model = genai.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
    const prompt = buildAssistantPrompt({ context, history: [], question: message });
    const result = await model.generateContent(prompt);

    res.json({
      success: true,
      data: {
        reply: result.response.text(),
        aiEnabled: true,
      },
    });
  } catch (err) {
    logger.error('Gemini chat error', { error: err.message });
    if (isQuotaError(err)) {
      return res.status(429).json(quotaExhaustedResponse(err));
    }
    res.status(500).json({ success: false, message: 'AI request failed: ' + err.message });
  }
});

router.post('/chat/stream', protect, async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ success: false, message: 'message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const [context, session] = await Promise.all([
      buildAssistantContext(req.orgId),
      getOrCreateSession({
        orgId: req.orgId,
        userId: req.user._id,
        sessionId,
        initialQuestion: message,
      }),
    ]);

    writeSSE(res, { type: 'session', sessionId: session._id });

    const history = serializeHistory(session.messages.slice(-SESSION_WINDOW_MESSAGES));
    const prompt = buildAssistantPrompt({ context, history, question: message });
    const genai = getGenai();

    if (!genai) {
      const reply = buildFallbackReply(context, message);
      await AISession.findByIdAndUpdate(session._id, {
        $push: {
          messages: {
            $each: [
              { role: 'user', content: message },
              { role: 'assistant', content: reply },
            ],
          },
        },
        $set: { lastUsedAt: new Date() },
      });
      writeSSE(res, { type: 'chunk', content: reply });
      writeSSE(res, { type: 'done' });
      return res.end();
    }

    const model = genai.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
    const result = await model.generateContentStream(prompt);
    let reply = '';

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (!text) continue;
      reply += text;
      writeSSE(res, { type: 'chunk', content: text });
    }

    await AISession.findByIdAndUpdate(session._id, {
      $push: {
        messages: {
          $each: [
            { role: 'user', content: message },
            { role: 'assistant', content: reply },
          ],
        },
      },
      $set: { lastUsedAt: new Date() },
    });

    writeSSE(res, { type: 'done' });
    return res.end();
  } catch (err) {
    logger.error('Gemini chat stream error', { error: err.message });
    if (isQuotaError(err)) {
      writeSSE(res, {
        type: 'error',
        quotaExhausted: true,
        retryAfterSeconds: retryAfterSeconds(err),
        message: `AI quota exhausted — free-tier limit reached. Please retry in ${retryAfterSeconds(err)}s.`,
      });
    } else {
      writeSSE(res, { type: 'error', message: 'AI request failed: ' + err.message });
    }
    return res.end();
  }
});

router.post('/summarize-blockers', protect, async (req, res) => {
  try {
    const orgId = req.orgId;
    const context = await buildAssistantContext(orgId);
    const genai = getGenai();

    if (!genai) {
      const stalledPRs = await PullRequest.find({
        orgId,
        state: 'open',
        lastActivityAt: { $lt: new Date(Date.now() - 48 * 3600 * 1000) },
      }).limit(10);

      const epicPRs = await PullRequest.find({
        orgId,
        state: 'open',
        complexityLabel: { $in: ['epic', 'high'] },
      }).limit(5);

      const noReviewerPRs = await PullRequest.find({
        orgId,
        state: 'open',
        requestedReviewers: { $size: 0 },
      }).limit(10);

      return res.json({
        success: true,
        data: {
          stalledPRs: stalledPRs.map((p) => ({
            title: p.title,
            number: p.number,
            repo: p.repoFullName,
            stallReason: p.stallReason,
            hoursSinceActivity: p.lastActivityAt
              ? Math.round((Date.now() - p.lastActivityAt) / 3600000)
              : 'unknown',
          })),
          epicPRsAtRisk: epicPRs.map((p) => ({
            title: p.title,
            number: p.number,
            repo: p.repoFullName,
            complexity: p.complexityLabel,
            shipProbability: p.shipProbability,
          })),
          prsNeedingReviewer: noReviewerPRs.map((p) => ({
            title: p.title,
            number: p.number,
            repo: p.repoFullName,
            author: p.authorUsername,
          })),
          generatedAt: new Date().toISOString(),
          note: 'Add GEMINI_API_KEY to get natural language summaries.',
        },
      });
    }

    const model = genai.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
    const prompt = `You are an engineering manager assistant reviewing sprint blockers.

Sprint snapshot: ${JSON.stringify(context.sprintSnapshot, null, 2)}
Open stalled PRs: ${JSON.stringify(context.stalledPRs, null, 2)}
Reviewer loads: ${JSON.stringify(context.reviewerLoads, null, 2)}

Write a plain-English blocker summary in exactly this format:

**Sprint Blockers Summary**
[2-3 sentences on the biggest systemic issues — distinguish review culture problems from complexity.]

**Immediate Actions**
- [Action 1: specific, name PR numbers only when useful]
- [Action 2]
- [Action 3]

**Watch List**
- [PRs that need monitoring but are not blockers yet]

Surface process signals and patterns only. Do not attribute problems to named individuals.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    res.json({ success: true, data: { summary, aiEnabled: true, generatedAt: new Date().toISOString() } });
  } catch (err) {
    logger.error('Gemini summarize-blockers error', { error: err.message });
    if (isQuotaError(err)) {
      return res.status(429).json(quotaExhaustedResponse(err));
    }
    res.status(500).json({ success: false, message: 'AI request failed: ' + err.message });
  }
});

router.post('/recommend-reviewer', protect, async (req, res) => {
  try {
    const { prId } = req.body;
    const pr = await PullRequest.findOne({ _id: prId, orgId: req.orgId });
    if (!pr) return res.status(404).json({ success: false, message: 'PR not found' });

    const recentMergers = await PullRequest.find({
      orgId: req.orgId,
      repoFullName: pr.repoFullName,
      state: 'merged',
      mergedAt: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    }).select('authorUsername');

    const authorCounts = {};
    for (const mergedPr of recentMergers) {
      if (mergedPr.authorUsername && mergedPr.authorUsername !== pr.authorUsername) {
        authorCounts[mergedPr.authorUsername] = (authorCounts[mergedPr.authorUsername] || 0) + 1;
      }
    }

    const contributors = await Contributor.find({
      orgId: req.orgId,
      username: { $in: Object.keys(authorCounts) },
    }).select('username reviewerLoadIndex');

    const loadMap = {};
    for (const contributor of contributors) loadMap[contributor.username] = contributor.reviewerLoadIndex || 0;

    const totalRecentMerges = Math.max(recentMergers.length, 1);
    const candidates = Object.entries(authorCounts)
      .map(([username, merges]) => ({
        username,
        merges,
        ownershipShare: Math.round((merges / totalRecentMerges) * 100),
        load: loadMap[username] ?? 0,
        score: Math.max(0, Math.min(100, merges * 15 - (loadMap[username] || 0) * 10)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const genai = getGenai();
    if (!genai || candidates.length === 0) {
      return res.json({
        success: true,
        data: {
          pr: pr.title,
          rankings: candidates.map((candidate, index) => ({
            username: candidate.username,
            rank: index + 1,
            reason: `Proxy ownership ${candidate.ownershipShare}% in ${pr.repoFullName}, reviewer load ${candidate.load.toFixed(1)}`,
            justification: `Owns ${candidate.ownershipShare}% of this file area proxy, lightly loaded`,
            ownershipShare: candidate.ownershipShare,
            load: Number(candidate.load.toFixed(1)),
            score: candidate.score,
          })),
          aiEnabled: false,
        },
      });
    }

    const model = genai.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
    const candidateLines = candidates.map((candidate) =>
      `  - @${candidate.username}: ${candidate.merges} recent merges, proxy ownership ${candidate.ownershipShare}%, reviewer load ${candidate.load.toFixed(1)}, base score ${candidate.score}`
    ).join('\n');

    const prompt = `You are a senior engineering manager. Rank reviewer candidates for this pull request.

PR #${pr.number}: "${pr.title}"
Author: @${pr.authorUsername}
Complexity: ${pr.complexityLabel}
Stall reason: ${pr.stallReason ? STALL_LABELS[pr.stallReason] : 'none — active'}
Lines changed: +${pr.linesAdded} -${pr.linesRemoved}
Description: ${pr.body || 'No description provided'}

Candidates:
${candidateLines}

Return strict JSON in this shape:
{
  "rankings": [
    {
      "username": "someone",
      "rank": 1,
      "reason": "short ranking reason",
      "justification": "SHAP-style card text such as owns 70% of this file area proxy, lightly loaded"
    }
  ]
}

Use the merge share as a proxy for ownership. Prefer lightly loaded reviewers. Surface process signals only.`;

    const result = await model.generateContent(prompt);
    const parsed = parseJsonResponse(result.response.text());
    const rankings = (parsed.rankings || [])
      .map((entry) => {
        const candidate = candidates.find((item) => item.username === entry.username);
        if (!candidate) return null;
        return {
          username: candidate.username,
          rank: entry.rank,
          reason: entry.reason,
          justification: entry.justification || `Owns ${candidate.ownershipShare}% of this file area proxy, lightly loaded`,
          ownershipShare: candidate.ownershipShare,
          load: Number(candidate.load.toFixed(1)),
          score: candidate.score,
        };
      })
      .filter(Boolean);

    res.json({
      success: true,
      data: {
        pr: pr.title,
        rankings: rankings.length ? rankings : candidates.slice(0, 3).map((candidate, index) => ({
          username: candidate.username,
          rank: index + 1,
          reason: `Proxy ownership ${candidate.ownershipShare}% with reviewer load ${candidate.load.toFixed(1)}`,
          justification: `Owns ${candidate.ownershipShare}% of this file area proxy, lightly loaded`,
          ownershipShare: candidate.ownershipShare,
          load: Number(candidate.load.toFixed(1)),
          score: candidate.score,
        })),
        aiEnabled: true,
      },
    });
  } catch (err) {
    logger.error('Gemini recommend-reviewer error', { error: err.message });
    if (isQuotaError(err)) {
      return res.status(429).json(quotaExhaustedResponse(err));
    }
    res.status(500).json({ success: false, message: 'AI request failed: ' + err.message });
  }
});

router.post('/classify-complexity', protect, async (req, res) => {
  try {
    const { prId } = req.body;
    const pr = await PullRequest.findOne({ _id: prId, orgId: req.orgId });
    if (!pr) return res.status(404).json({ success: false, message: 'PR not found' });

    const genai = getGenai();
    if (!genai) {
      return res.json({
        success: true,
        data: {
          complexityLabel: pr.complexityLabel,
          aiEnabled: false,
          note: 'Add GEMINI_API_KEY to enable Gemini Flash complexity classification.',
        },
      });
    }

    const model = genai.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
    const prompt = `Classify this pull request into exactly one of: low, medium, high, epic.

PR title: ${pr.title}
Description: ${pr.body || 'No description provided'}
Repo: ${pr.repoFullName}
Lines added: ${pr.linesAdded}
Lines removed: ${pr.linesRemoved}
Files changed: ${pr.filesChanged}
Commits: ${pr.commits}
Draft: ${pr.isDraft ? 'yes' : 'no'}
Scope creep: ${pr.scopeCreepFlag ? 'yes' : 'no'}

Return strict JSON:
{
  "complexityLabel": "low|medium|high|epic",
  "reason": "short explanation"
}`;

    const result = await model.generateContent(prompt);
    const parsed = parseJsonResponse(result.response.text());
    const allowed = ['low', 'medium', 'high', 'epic'];
    const complexityLabel = allowed.includes(parsed.complexityLabel) ? parsed.complexityLabel : pr.complexityLabel;

    await PullRequest.updateOne({ _id: pr._id }, { $set: { complexityLabel } });

    res.json({
      success: true,
      data: {
        complexityLabel,
        reason: parsed.reason,
        aiEnabled: true,
      },
    });
  } catch (err) {
    logger.error('Gemini classify-complexity error', { error: err.message });
    if (isQuotaError(err)) {
      return res.status(429).json(quotaExhaustedResponse(err));
    }
    res.status(500).json({ success: false, message: 'AI request failed: ' + err.message });
  }
});

router.post('/generate-changelog', protect, async (req, res) => {
  try {
    const { startDate: rawStartDate, endDate: rawEndDate } = req.body;
    const { startDate, endDate } = parseDateRange(rawStartDate, rawEndDate);

    const mergedPRs = await PullRequest.find({
      orgId: req.orgId,
      state: 'merged',
      mergedAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ mergedAt: -1 })
      .select('number title body repoFullName mergedAt labels')
      .limit(100);

    if (!mergedPRs.length) {
      return res.json({
        success: true,
        data: {
          markdown: `# Changelog\n\n## ${endDate.toISOString().slice(0, 10)}\n\n_No merged PRs found for this range._\n`,
          aiEnabled: false,
        },
      });
    }

    const genai = getGenai();
    if (!genai) {
      const markdown = [
        '# Changelog',
        '',
        '## Features',
        ...mergedPRs.slice(0, 5).map((pr) => `- ${pr.title} ([#${pr.number}])`),
        '',
        '## Fixes',
        '',
        '## Chores',
        '',
      ].join('\n');
      return res.json({ success: true, data: { markdown, aiEnabled: false } });
    }

    const model = genai.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
    const prSummary = mergedPRs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      repoFullName: pr.repoFullName,
      mergedAt: pr.mergedAt,
      labels: pr.labels?.map((label) => label.name) || [],
    }));

    const prompt = `Categorise these merged PRs into Features / Fixes / Chores.
Format the result as Keep a Changelog markdown.
Use concise bullets and include PR numbers.

Date range:
- Start: ${startDate.toISOString()}
- End: ${endDate.toISOString()}

Merged PRs:
${JSON.stringify(prSummary, null, 2)}`;

    const result = await model.generateContent(prompt);
    res.json({
      success: true,
      data: {
        markdown: result.response.text(),
        aiEnabled: true,
      },
    });
  } catch (err) {
    logger.error('Gemini generate-changelog error', { error: err.message });
    if (isQuotaError(err)) {
      return res.status(429).json(quotaExhaustedResponse(err));
    }
    res.status(500).json({ success: false, message: 'AI request failed: ' + err.message });
  }
});

router.post('/generate-retro', protect, async (req, res) => {
  try {
    const { startDate: rawStartDate, endDate: rawEndDate } = req.body;
    const { startDate, endDate } = parseDateRange(rawStartDate, rawEndDate);
    const context = await buildRetroContext(req.orgId, startDate, endDate);
    const genai = getGenai();

    if (!genai) {
      const fallback = `# Sprint Retrospective\n\n## What went well\n- Throughput remained visible across the sprint.\n\n## What was slow\n- Review and stall patterns need follow-up.\n\n## Suggested actions\n- Break large PRs down earlier.\n- Assign reviewers sooner.\n- Watch churn outliers before they stall.\n`;
      return res.json({ success: true, data: { draft: fallback, aiEnabled: false, context } });
    }

    const model = genai.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
    const prompt = `Write a sprint retrospective draft covering:
- what went well
- what was slow
- suggested actions

Data:
${JSON.stringify(context, null, 2)}

Constraints:
- Focus on process and system patterns.
- Do not attribute problems to named individuals.
- Output markdown with sections:
  - What went well
  - What was slow
  - Suggested actions`;

    const result = await model.generateContent(prompt);
    res.json({
      success: true,
      data: {
        draft: result.response.text(),
        aiEnabled: true,
        context,
      },
    });
  } catch (err) {
    logger.error('Gemini generate-retro error', { error: err.message });
    if (isQuotaError(err)) {
      return res.status(429).json(quotaExhaustedResponse(err));
    }
    res.status(500).json({ success: false, message: 'AI request failed: ' + err.message });
  }
});

router.get('/retrospectives', protect, async (req, res) => {
  try {
    const sprints = await Sprint.find({ orgId: req.orgId })
      .sort({ endDate: -1, createdAt: -1 })
      .limit(20);
    
    // Map to old names for frontend compatibility
    const retros = sprints.map(s => ({
      _id: s._id,
      title: s.name,
      sprintStart: s.startDate,
      sprintEnd: s.endDate,
      content: s.aiSummary,
      status: s.status,
      createdAt: s.createdAt
    }));

    res.json({ success: true, data: retros });
  } catch (err) {
    logger.error('List retrospectives error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to load retrospectives' });
  }
});

router.post('/retrospectives', protect, async (req, res) => {
  try {
    const { title, sprintStart, sprintEnd, content } = req.body;
    if (!title || !sprintStart || !sprintEnd || !content) {
      return res.status(400).json({ success: false, message: 'title, sprintStart, sprintEnd, and content are required' });
    }

    const sprint = await Sprint.create({
      orgId: req.orgId,
      name: title,
      startDate: new Date(sprintStart),
      endDate: new Date(sprintEnd),
      aiSummary: content,
      status: 'closed'
    });

    res.status(201).json({ success: true, data: sprint });
  } catch (err) {
    logger.error('Save retrospective error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to save retrospective' });
  }
});

export default router;
