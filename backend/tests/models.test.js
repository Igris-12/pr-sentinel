import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import PullRequest from '../models/PullRequest.js';
import RiskAnalysis from '../models/RiskAnalysis.js';
import PROutcome from '../models/PROutcome.js';
import Sprint from '../models/Sprint.js';
import ActionItem from '../models/ActionItem.js';

test('PullRequest model schema', (t) => {
  const pr = new PullRequest({
    orgId: new mongoose.Types.ObjectId(),
    repoId: new mongoose.Types.ObjectId(),
    repoFullName: 'test/repo',
    githubPrId: 123,
    number: 1,
    title: 'Test PR',
    riskScore: 7.5,
    riskLabel: 'HIGH',
    stallReason: 'WAITING_CI'
  });

  assert.strictEqual(pr.riskScore, 7.5);
  assert.strictEqual(pr.riskLabel, 'HIGH');
  assert.strictEqual(pr.stallReason, 'WAITING_CI');
});

test('RiskAnalysis model schema', (t) => {
  const ra = new RiskAnalysis({
    prId: new mongoose.Types.ObjectId(),
    githubPrNumber: 1,
    repoId: new mongoose.Types.ObjectId(),
    orgId: new mongoose.Types.ObjectId(),
    riskScore: 7.5,
    riskLabel: 'HIGH',
    radar: { logicRisk: 8 }
  });

  assert.strictEqual(ra.riskScore, 7.5);
  assert.strictEqual(ra.riskLabel, 'HIGH');
  assert.strictEqual(ra.radar.logicRisk, 8);
});

test('PROutcome model schema', (t) => {
  const po = new PROutcome({
    prId: new mongoose.Types.ObjectId(),
    orgId: new mongoose.Types.ObjectId(),
    outcome: 'SAFE'
  });

  assert.strictEqual(po.outcome, 'SAFE');
});

test('Sprint model schema', (t) => {
  const sprint = new Sprint({
    orgId: new mongoose.Types.ObjectId(),
    name: 'Sprint 1',
    startDate: new Date(),
    endDate: new Date(),
    status: 'active',
    metrics: { avgCycleTime: 12.5 }
  });

  assert.strictEqual(sprint.name, 'Sprint 1');
  assert.strictEqual(sprint.status, 'active');
  assert.strictEqual(sprint.metrics.avgCycleTime, 12.5);
});

test('ActionItem model schema', (t) => {
  const actionItem = new ActionItem({
    sprintId: new mongoose.Types.ObjectId(),
    orgId: new mongoose.Types.ObjectId(),
    description: 'Fix the bug',
    status: 'open',
    priority: 'high'
  });

  assert.strictEqual(actionItem.description, 'Fix the bug');
  assert.strictEqual(actionItem.status, 'open');
  assert.strictEqual(actionItem.priority, 'high');
});
