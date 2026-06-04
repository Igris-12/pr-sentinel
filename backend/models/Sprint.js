import mongoose from 'mongoose';

const sprintSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
    name: { type: String, required: true }, // e.g., "Sprint 12 — May 2026"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { 
      type: String, 
      enum: ['draft', 'active', 'closed'], 
      default: 'draft' 
    },

    // Auto-populated from MetricSnapshots for the sprint window
    metrics: {
      avgCycleTime: { type: Number },    // hours
      prsMerged: { type: Number },
      churnRate: { type: Number },
      wipHighWaterMark: { type: Number },
      avgRiskScore: { type: Number },
      highRiskPrCount: { type: Number },
      criticalRiskPrCount: { type: Number }
    },

    // Gemini-generated narrative (editable after generation)
    aiSummary: { type: String },
    aiSummaryGeneratedAt: { type: Date },
    summaryEditedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Sprint health score (0–10, computed on close)
    healthScore: { type: Number, min: 0, max: 10 },
    healthTrend: { 
      type: String, 
      enum: ['improving', 'stable', 'degrading'] 
    },

    // Linked Action Items (referenced by their own model, but can be populated)
    actionItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ActionItem' }],

    // Export
    exportedPdfUrl: { type: String },
    exportedAt: { type: Date },

    // Added for indexing optimization as per task instructions
    prId: { type: mongoose.Schema.Types.ObjectId, ref: 'PullRequest' },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

sprintSchema.index({ orgId: 1, endDate: -1 });
sprintSchema.index({ prId: 1, timestamp: -1 });

export default mongoose.model('Sprint', sprintSchema);
