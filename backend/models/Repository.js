import mongoose from 'mongoose';

const repositorySchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    platform: { type: String, enum: ['github', 'gitlab'], default: 'github' },
    owner: { type: String, required: true },      // GitHub username/org
    name: { type: String, required: true },        // repo name
    fullName: { type: String, required: true },    // owner/name
    defaultBranch: { type: String, default: 'main' },
    isActive: { type: Boolean, default: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastSyncedAt: { type: Date },
    webhookId: { type: Number },                   // GitHub webhook ID for cleanup
  },
  { timestamps: true }
);

repositorySchema.index({ orgId: 1 });
repositorySchema.index({ fullName: 1 });

export default mongoose.model('Repository', repositorySchema);
