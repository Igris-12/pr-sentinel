import mongoose from 'mongoose';

const contributorSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    platformUserId: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String },
    avatarUrl: { type: String },
    timezone: { type: String },
    // Computed reviewer metrics (updated on each sync)
    reviewerLoadIndex: { type: Number, default: 0 },    // open review requests / 7d throughput
    reviewQualityScore: { type: Number, default: 0 },   // 0-1: depth of comments relative to lines reviewed
    totalReviewsThisWeek: { type: Number, default: 0 },
    avgReviewDepthScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

contributorSchema.index({ orgId: 1, username: 1 }, { unique: true });

export default mongoose.model('Contributor', contributorSchema);
