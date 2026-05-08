import mongoose from 'mongoose';
import PullRequest from './models/PullRequest.js';
import MetricSnapshot from './models/MetricSnapshot.js';
import Repository from './models/Repository.js';
import dotenv from 'dotenv';
dotenv.config();

async function clearDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    // Wipe PRs and snapshots to remove all previous fake/demo sync data
    await PullRequest.deleteMany({});
    console.log('Cleared all Pull Requests');
    
    await MetricSnapshot.deleteMany({});
    console.log('Cleared all Metric Snapshots');

    // Make sure we set repo lastSyncedAt to null so it forces a sync next time
    await Repository.updateMany({}, { $set: { lastSyncedAt: null } });
    console.log('Reset repository synced status');

    console.log('Database successfully wiped! Ready for a fresh, authentic sync.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
clearDB();
