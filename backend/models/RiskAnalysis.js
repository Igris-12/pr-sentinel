import mongoose from 'mongoose';

const riskAnalysisSchema = new mongoose.Schema(
  {
    prId: { type: mongoose.Schema.Types.ObjectId, ref: 'PullRequest', required: true },
    githubPrNumber: { type: Number, required: true },
    repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },

    // Scores
    riskScore: { type: Number, min: 0, max: 10, required: true },
    riskLabel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
    confidence: { type: Number, min: 0, max: 1 },

    // Rationale
    rationale: [{ type: String }],

    // Radar dimensions
    radar: {
      dependencyRisk: { type: Number, min: 0, max: 10 },
      logicRisk: { type: Number, min: 0, max: 10 },
      dataExposure: { type: Number, min: 0, max: 10 },
      testingCoverage: { type: Number, min: 0, max: 10 }
    },

    // Blast radius
    blastRadius: {
      affectedServiceCount: { type: Number, default: 0 },
      affectedFiles: [{ type: String }],
      graphSnapshot: { type: String } // JSON serialized Neo4j subgraph
    },

    // Static analysis
    staticMetrics: {
      linesAdded: { type: Number, default: 0 },
      linesRemoved: { type: Number, default: 0 },
      filesChanged: { type: Number, default: 0 },
      cyclomaticComplexityDelta: { type: Number, default: 0 },
      churnHistoryScore: { type: Number, default: 0 },
      vulnerabilityFlags: [{
        severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        message: { type: String },
        line: { type: Number }
      }]
    },

    // Reviewer routing
    recommendedReviewers: [{ type: String }],
    assignedReviewer: { type: String },
    assignmentMethod: { type: String, enum: ['ai_suggested', 'heuristic', 'manual'] },

    // Annotated diff
    diffAnnotations: [{
      file: { type: String },
      line: { type: Number },
      severity: { type: String },
      note: { type: String }
    }],

    // Historical context
    similarHistoricalPRs: [{
      prNumber: { type: Number },
      similarity: { type: Number },
      outcome: { type: String }
    }],

    // Metadata
    analyzedAt: { type: Date, default: Date.now },
    geminiModelVersion: { type: String }
  },
  { timestamps: true }
);

riskAnalysisSchema.index({ orgId: 1, riskLabel: 1 });
riskAnalysisSchema.index({ prId: 1 });
riskAnalysisSchema.index({ repoId: 1 });

export default mongoose.model('RiskAnalysis', riskAnalysisSchema);
