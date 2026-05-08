import mongoose from 'mongoose';

const jiraIssueSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    issueKey: { type: String, required: true }, // e.g. PROJ-123
    issueId: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, required: true }, // To Do, In Progress, Done, etc.
    statusCategory: { type: String }, // new, indeterminate, done
    assigneeName: { type: String },
    assigneeEmail: { type: String },
    assigneeAvatar: { type: String },
    storyPoints: { type: Number, default: 0 },
    priority: { type: String }, // High, Medium, Low
    issueType: { type: String }, // Bug, Story, Task, Epic
    sprintName: { type: String },
    createdDate: { type: Date },
    updatedDate: { type: Date },
    resolutionDate: { type: Date },
  },
  { timestamps: true }
);

jiraIssueSchema.index({ orgId: 1, issueKey: 1 }, { unique: true });
jiraIssueSchema.index({ orgId: 1, statusCategory: 1 });

export default mongoose.model('JiraIssue', jiraIssueSchema);
