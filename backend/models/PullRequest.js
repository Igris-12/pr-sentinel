import mongoose from 'mongoose';

const pullRequestSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
    repoFullName: { type: String, required: true },
    githubPrId: { type: Number, required: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    body: { type: String },
    state: { type: String, enum: ['open', 'closed', 'merged'], default: 'open' },
    isDraft: { type: Boolean, default: false },
    authorUsername: { type: String },
    authorAvatarUrl: { type: String },
    // Jira Integration
    jiraIssueKey: { type: String, index: true },
    // Git metrics
    linesAdded: { type: Number, default: 0 },
    linesRemoved: { type: Number, default: 0 },
    filesChanged: { type: Number, default: 0 },
    commits: { type: Number, default: 0 },
    // Computed temporal metrics (seconds)
    cycleTimeSeconds: { type: Number },
    reviewLatencySeconds: { type: Number },     // first commit → first review
    timeToMergeSeconds: { type: Number },        // opened → merged
    churnRate: { type: Number, default: 0 },     // re-reviews / total reviews
    reviewDepthScore: { type: Number, default: 0 }, // 0-1
    // AI-computed fields
    complexityLabel: { type: String, enum: ['trivial', 'low', 'medium', 'high', 'epic'], default: 'medium' },
    shipProbability: { type: Number },          // 0-100
    stallProbability: { type: Number },         // 0-1
    scopeCreepFlag: { type: Boolean, default: false },
    // Nuance signal: WHY is this PR slow?
    // Culture problems: REVIEWER_INACTIVE, NO_REVIEWER, CHURNING
    // Legitimate complexity: COMPLEX_IN_REVIEW, NEEDS_EXPERT
    // Generic: STALLED, null (active/healthy)
    stallReason: {
      type: String,
      enum: ['REVIEWER_INACTIVE', 'NO_REVIEWER', 'CHURNING', 'COMPLEX_IN_REVIEW', 'NEEDS_EXPERT', 'STALLED', null],
      default: null,
    },
    // Timestamps
    firstCommitAt: { type: Date },
    openedAt: { type: Date },
    firstReviewAt: { type: Date },
    mergedAt: { type: Date },
    closedAt: { type: Date },
    lastActivityAt: { type: Date },
    // GitHub URL
    htmlUrl: { type: String },
    // Reviewers assigned
    requestedReviewers: [{
      username: String,
      avatarUrl: String,
      displayName: String,           // persisted so it shows on refresh
      assignmentMethod: String,      // 'github_assigned' | 'comment_tagged' | 'socket_notified'
      assignedAt: { type: Date, default: Date.now },
    }],
    // Labels
    labels: [{ name: String, color: String }],
  },
  { timestamps: true }
);

pullRequestSchema.index({ orgId: 1, state: 1 });
pullRequestSchema.index({ repoId: 1  });
pullRequestSchema.index({ orgId: 1, openedAt: -1 });
pullRequestSchema.index({ repoFullName: 1, githubPrId: 1 }, { unique: true });

export default mongoose.model('PullRequest', pullRequestSchema);
