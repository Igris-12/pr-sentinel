import mongoose from 'mongoose';

const metricSnapshotSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
    date: { type: Date, required: true },
    // Cycle time percentiles (seconds)
    cycleTimeP50: { type: Number },
    cycleTimeP75: { type: Number },
    cycleTimeP95: { type: Number },
    // Review latency percentiles (seconds)
    reviewLatencyP50: { type: Number },
    reviewLatencyP75: { type: Number },
    reviewLatencyP95: { type: Number },
    // Counts
    mergedCount: { type: Number, default: 0 },
    openCount: { type: Number, default: 0 },
    closedCount: { type: Number, default: 0 },
    avgChurnRate: { type: Number, default: 0 },
    // Throughput - PRs merged per day over trailing 7 days
    throughput7d: { type: Number, default: 0 },
    // Sprint health score (0-100)
    sprintHealthScore: { type: Number },
  },
  { timestamps: true }
);

metricSnapshotSchema.index({ repoId: 1, date: -1 });
metricSnapshotSchema.index({ orgId: 1, date: -1 });

export default mongoose.model('MetricSnapshot', metricSnapshotSchema);
