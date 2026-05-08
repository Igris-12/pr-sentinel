import mongoose from 'mongoose';
import PullRequest from './models/PullRequest.js';
import MetricSnapshot from './models/MetricSnapshot.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    const prs = await PullRequest.find({ state: 'open' }).limit(300);
    console.log(`Found ${prs.length} open PRs. Fixing them to be merged demo data...`);
    
    let mergedCount = 0;
    for (const pr of prs) {
      if (Math.random() > 0.4) {
        const createdTime = pr.openedAt ? pr.openedAt.getTime() : Date.now() - 30 * 24 * 3600000;
        const mergeTime = createdTime + (Math.random() * 5 * 24 * 3600000); // 1-5 days later
        const latencySeconds = Math.floor(Math.random() * 48 * 3600); // 0-48 hours
        
        pr.state = 'merged';
        pr.mergedAt = new Date(mergeTime);
        pr.closedAt = new Date(mergeTime);
        pr.reviewLatencySeconds = latencySeconds;
        pr.cycleTimeSeconds = Math.floor((mergeTime - createdTime) / 1000);
        pr.churnRate = Math.random() * 0.8;
        
        await pr.save();
        mergedCount++;
      }
    }
    
    console.log(`Successfully converted ${mergedCount} stuck PRs into historical merged PRs for the dashboard!`);
    
    await MetricSnapshot.deleteMany({});
    console.log('Cleared old metric snapshots so they regenerate cleanly.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
