import mongoose from 'mongoose';

const aiMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiSessionSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'AI Assistant Session' },
    messages: { type: [aiMessageSchema], default: [] },
    lastUsedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

aiSessionSchema.index({ orgId: 1, userId: 1, lastUsedAt: -1 });

export default mongoose.model('AISession', aiSessionSchema);
