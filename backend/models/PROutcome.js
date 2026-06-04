import mongoose from 'mongoose';

const proOutcomeSchema = new mongoose.Schema(
  {
    prId: { type: mongoose.Schema.Types.ObjectId, ref: 'PullRequest', required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    mergedAt: { type: Date },
    detectedAt: { type: Date, default: Date.now },
    outcome: {
      type: String,
      enum: ['SAFE', 'REGRESSION', 'PREVENTED'],
      required: true
    },
    incidentLinks: [{ type: String }], // Sentry issue URLs, PagerDuty incidents
    errorRateSpike: { type: Boolean, default: false },
    reviewerFeedback: { type: String },
    usedForRetraining: { type: Boolean, default: false }
  },
  { timestamps: true }
);

proOutcomeSchema.index({ orgId: 1, outcome: 1 });
proOutcomeSchema.index({ prId: 1 }, { unique: true });

export default mongoose.model('PROutcome', proOutcomeSchema);
