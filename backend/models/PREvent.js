import mongoose from 'mongoose';

const prEventSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    prId: { type: mongoose.Schema.Types.ObjectId, ref: 'PullRequest', required: true },
    repoFullName: { type: String },
    eventType: {
      type: String,
      enum: ['opened', 'review_submitted', 'commit_pushed', 'merged', 'closed', 'commented', 'review_requested', 'labeled'],
      required: true,
    },
    actorUsername: { type: String },
    actorAvatarUrl: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed }, // raw condensed event data
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

prEventSchema.index({ prId: 1, occurredAt: 1 });
prEventSchema.index({ orgId: 1, occurredAt: -1 });

export default mongoose.model('PREvent', prEventSchema);
