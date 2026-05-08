import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    avatar: { type: String },
    // GitHub integration
    githubUsername: { type: String },
    githubPatEncrypted: { type: String }, // encrypted with Cryptr
    // Org membership
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation' },
    role: { type: String, enum: ['viewer', 'contributor', 'manager', 'admin'], default: 'manager' },
    // Token management
    refreshToken: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
