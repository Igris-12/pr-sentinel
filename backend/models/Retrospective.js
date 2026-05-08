import mongoose from 'mongoose';

const retrospectiveSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    sprintStart: { type: Date, required: true },
    sprintEnd: { type: Date, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

retrospectiveSchema.index({ orgId: 1, sprintEnd: -1 });

export default mongoose.model('Retrospective', retrospectiveSchema);
