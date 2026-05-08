import express from 'express';
import axios from 'axios';
import Org from '../models/Organisation.js';
import JiraIssue from '../models/JiraIssue.js';
import PullRequest from '../models/PullRequest.js';
import logger from '../config/logger.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper to fetch Jira issues paginated.
 */
const fetchIssuesFromJira = async (domain, email, token, projectKey) => {
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  let issues = [];
  let startAt = 0;
  const maxResults = 100;
  let isLast = false;

  const jql = projectKey ? `project=${projectKey}` : 'order by created DESC';

  while (!isLast) {
    const res = await axios.get(
      `${domain}/rest/api/3/search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      }
    );
    issues = issues.concat(res.data.issues);
    if (startAt + maxResults >= res.data.total) {
      isLast = true;
    } else {
      startAt += maxResults;
    }
  }

  return issues;
};

/**
 * POST /api/jira/sync
 * Manually trigger a Jira sync.
 */
router.post('/sync', protect, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { JIRA_DOMAIN, JIRA_EMAIL, JIRA_TOKEN } = process.env;

    if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_TOKEN) {
      // Demo mode bypass: Return gracefully so the UI doesn't throw an error during the hackathon
      return res.status(200).json({ 
        success: true, 
        message: 'Running in Demo Mode: Jira credentials not set. Using existing mock data!' 
      });
    }

    // In a real scenario, projectKey might be stored in Org settings.
    // For now, we fetch all issues or a configurable one.
    const issues = await fetchIssuesFromJira(JIRA_DOMAIN, JIRA_EMAIL, JIRA_TOKEN, '');

    let syncedCount = 0;
    for (const raw of issues) {
      const issueKey = raw.key;
      const issueId = raw.id;
      const title = raw.fields.summary || '';
      const statusName = raw.fields.status?.name || 'To Do';
      const statusCategoryName = raw.fields.status?.statusCategory?.key || 'new'; // new, indeterminate, done
      
      const assigneeStr = raw.fields.assignee?.displayName || null;
      const assigneeEmail = raw.fields.assignee?.emailAddress || null;
      const assigneeAvatar = raw.fields.assignee?.avatarUrls?.['48x48'] || null;

      const storyPointsField = Object.keys(raw.fields).find(k => k.startsWith('customfield_') && typeof raw.fields[k] === 'number');
      const storyPoints = storyPointsField ? raw.fields[storyPointsField] : 0;

      const priority = raw.fields.priority?.name || null;
      const issueType = raw.fields.issuetype?.name || null;
      const createdDate = raw.fields.created;
      const updatedDate = raw.fields.updated;
      const resolutionDate = raw.fields.resolutiondate;

      await JiraIssue.findOneAndUpdate(
        { orgId, issueKey },
        {
          issueId,
          title,
          status: statusName,
          statusCategory: statusCategoryName,
          assigneeName: assigneeStr,
          assigneeEmail,
          assigneeAvatar,
          storyPoints,
          priority,
          issueType,
          createdDate,
          updatedDate,
          resolutionDate,
        },
        { upsert: true, new: true }
      );
      syncedCount++;

      // Link PRs where PR title contains issueKey (e.g. "PROJ-123 Fix bug")
      // Check if any PR hasn't linked yet but has matching title
      await PullRequest.updateMany(
        { 
          orgId, 
          jiraIssueKey: { $exists: false }, 
          title: { $regex: issueKey, $options: 'i' } 
        },
        { $set: { jiraIssueKey: issueKey } }
      );
    }

    res.json({ success: true, message: `Synced ${syncedCount} issues and mapped to PRs.` });
  } catch (err) {
    logger.error('Jira sync failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to sync from Jira' });
  }
});

/**
 * GET /api/jira/dashboard
 * Fetch Jira analytics for the dashboard
 */
router.get('/dashboard', protect, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const allIssues = await JiraIssue.find({ orgId });
    if (!allIssues.length) {
      return res.json({ success: true, data: null }); // No Jira data yet
    }

    // 1. Ticket Progress
    const statusCounts = { todo: 0, inProgress: 0, done: 0 };
    // 2. Dev Workload
    const workload = {};
    // 3. Idle Tickets
    let idleCount = 0;
    const idleTickets = [];
    const now = new Date();

    allIssues.forEach((issue) => {
      // Status
      if (issue.statusCategory === 'new') statusCounts.todo++;
      else if (issue.statusCategory === 'done') statusCounts.done++;
      else statusCounts.inProgress++;

      // Assignee Workload (only active tickets)
      if (issue.statusCategory !== 'done') {
        const dev = issue.assigneeName || 'Unassigned';
        if (!workload[dev]) workload[dev] = { count: 0, points: 0, avatar: issue.assigneeAvatar };
        workload[dev].count++;
        workload[dev].points += (issue.storyPoints || 0);

        // Idle check: older than 7 days, no update
        const daysSinceUpdate = (now - new Date(issue.updatedDate)) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > 7) {
          idleCount++;
          idleTickets.push({
            issueKey: issue.issueKey,
            title: issue.title,
            assigneeName: dev,
            assigneeAvatar: issue.assigneeAvatar,
            daysStalled: Math.round(daysSinceUpdate)
          });
        }
      }
    });

    const devWorkload = Object.keys(workload).map(name => ({
      name,
      ...workload[name]
    })).sort((a, b) => b.count - a.count);

    // 4. Find PR links to calc PR Delay vs Ticket Priority
    // E.g. PR Delay = ticket created -> PR opened
    // In advanced cases, PR open -> merge time, but we link it.
    const linkedPRs = await PullRequest.find({ orgId, jiraIssueKey: { $exists: true } });
    const delayData = [];
    
    linkedPRs.forEach(pr => {
      const issue = allIssues.find(i => i.issueKey === pr.jiraIssueKey);
      if (issue && pr.openedAt && issue.createdDate) {
        const delayDays = (new Date(pr.openedAt) - new Date(issue.createdDate)) / (1000 * 60 * 60 * 24);
        if (delayDays >= 0) { // sometimes PR opened before ticket if planning is retroactive, skip those
            delayData.push({
              issueKey: issue.issueKey,
              priority: issue.priority || 'Medium',
              delayDays: Math.round(delayDays * 10) / 10,
              prNumber: pr.number
            });
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalIssues: allIssues.length,
        statusCounts,
        devWorkload,
        idleCount,
        idleTickets,
        delayData: delayData.slice(0, 50) // sample for graph
      }
    });

  } catch (err) {
    logger.error('Jira dashboard fail', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to fetch Jira metrics' });
  }
});

export default router;
