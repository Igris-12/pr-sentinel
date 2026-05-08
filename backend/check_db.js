import 'dotenv/config';
import mongoose from 'mongoose';
import Repository from './models/Repository.js';
import User from './models/User.js';
import Cryptr from 'cryptr';
import { syncRepository } from './scripts/syncGitHub.js';

async function check() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/devdeck');
  const repos = await Repository.find();
  console.log('Repos found:', repos.map(r => r.fullName));

  const user = await User.findOne({ githubPatEncrypted: { $exists: true, $ne: null } });
  if (!user) {
    console.log('No user with PAT found');
    process.exit(1);
  }
  
  const cryptr = new Cryptr(process.env.PAT_ENCRYPTION_KEY || 'fallback_key_change_this');
  const pat = cryptr.decrypt(user.githubPatEncrypted);

  for (const repo of repos) {
    console.log('Syncing', repo.fullName, '...');
    try {
      await syncRepository(repo, pat, repo.orgId);
      console.log('Done:', repo.fullName);
    } catch (err) {
      console.log('Failed:', repo.fullName, err.message);
    }
  }

  process.exit(0);
}
check();
