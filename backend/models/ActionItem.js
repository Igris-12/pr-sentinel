import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema(
  {
    sprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', required: true, index: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
    description: { type: String, required: true },
    owner: { type: String }, // GitHub username of assigned contributor
    dueDate: { type: Date },
    status: { 
      type: String, 
      enum: ['open', 'in_progress', 'closed'], 
      default: 'open' 
    },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high'], 
      default: 'medium' 
    },

    // Longitudinal tracking
    carriedForwardFromSprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint' },
    carriedForwardCount: { type: Number, default: 0 },

    // Outcome validation (filled when status → closed)
    outcomeNote: { type: String },
    metricImproved: { type: Boolean },
    linkedMetric: { type: String }, // e.g., "avgCycleTime", "churnRate"

    closedAt: { type: Date }
  },
  { timestamps: true }
);

actionItemSchema.index({ orgId: 1, status: 1 });

export default mongoose.model('ActionItem', actionItemSchema);
