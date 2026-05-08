import mongoose from 'mongoose';

const organisationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    webhookSecret: { type: String },
    planTier: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    config: {
      businessHoursStart: { type: Number, default: 9 },   // hour of day
      businessHoursEnd: { type: Number, default: 18 },
      timezone: { type: String, default: 'UTC' },
      reviewLatencyAlertHours: { type: Number, default: 24 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Organisation', organisationSchema);
