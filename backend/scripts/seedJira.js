import 'dotenv/config';
import mongoose from 'mongoose';
import JiraIssue from '../models/JiraIssue.js';
import PullRequest from '../models/PullRequest.js';
import Org from '../models/Organisation.js';
import logger from '../config/logger.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/prsentinel';

const runSeed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to MongoDB. Starting Jira seed...');

    const orgs = await Org.find();
    if (!orgs.length) {
      logger.error('No organisation found in database. Run some PR syncs first or create an account!');
      process.exit(1);
    }

    // 2. Mock Jira Issues
    const devs = ['Alice Developer', 'Bob Engineer', 'Charlie Coder', 'Dana Dev'];
    const statuses = ['To Do', 'In Progress', 'In Review', 'Done'];
    const statusCats = ['new', 'indeterminate', 'indeterminate', 'done'];
    const types = ['Story', 'Bug', 'Task', 'Epic'];
    const priorities = ['High', 'Highest', 'Medium', 'Low'];

    for (const org of orgs) {
      const orgId = org._id;
      logger.info(`Creating mock Jira issues for Org ${org._id} (${org.name})...`);

      let issueCount = 100; // Generate 100 issues
      let dbIssuesCode = [];

      // Base date around 2 weeks ago to show some historical scatter
      const now = new Date();
      
      for (let i = 1; i <= issueCount; i++) {
          const devIdx = Math.floor(Math.random() * devs.length);
          const statusIdx = Math.floor(Math.random() * statuses.length);
          const createdDate = new Date(now.getTime() - (Math.random() * 30 * 24 * 60 * 60 * 1000)); // Up to 30 days ago
          let updatedDate = new Date(createdDate.getTime() + (Math.random() * 5 * 24 * 60 * 60 * 1000));
          if (updatedDate > now) updatedDate = now;
          
          let resolutionDate = statusCats[statusIdx] === 'done' ? new Date(updatedDate.getTime() + (2 * 24 * 60 * 60 * 1000)) : null;
          if (resolutionDate && resolutionDate > now) resolutionDate = now;

          dbIssuesCode.push({
              orgId,
              issueKey: `PROJ-${1000 + i}`,
              issueId: `100${1000 + i}`,
              title: `Mock Jira Ticket ${i}`,
              status: statuses[statusIdx],
              statusCategory: statusCats[statusIdx],
              assigneeName: devs[devIdx],
              assigneeEmail: `${devs[devIdx].split(' ')[0].toLowerCase()}@example.com`,
              storyPoints: [1, 2, 3, 5, 8][Math.floor(Math.random() * 5)],
              priority: priorities[Math.floor(Math.random() * priorities.length)],
              issueType: types[Math.floor(Math.random() * types.length)],
              createdDate,
              updatedDate,
              resolutionDate
          });
      }

      await JiraIssue.deleteMany({ orgId, issueKey: { $regex: '^PROJ-' } }); 
      await JiraIssue.insertMany(dbIssuesCode);
      logger.info(`Successfully seeded ${issueCount} mock Jira issues for ${org.name}.`);

      // 3. Auto-map to some existing PullRequests using Regex mapping! 
      const prs = await PullRequest.find({ orgId });
      if (prs.length > 0) {
          logger.info(`Mapping Jira issues to ${prs.length} existing Pull Requests generically for ${org.name}...`);
          let mapCount = 0;
          
          for (const pr of prs) {
              const genericRegexMatch = pr.title.match(/[A-Z]+-\d+/i);
              
              if (genericRegexMatch) {
                  const foundKey = genericRegexMatch[0].toUpperCase();
                  await PullRequest.updateOne({ _id: pr._id }, { $set: { jiraIssueKey: foundKey } });
                  mapCount++;
              } else {
                  const randomMockIssue = dbIssuesCode[Math.floor(Math.random() * dbIssuesCode.length)];
                  await PullRequest.updateOne({ _id: pr._id }, { $set: { jiraIssueKey: randomMockIssue.issueKey } });
                  await PullRequest.updateOne({ _id: pr._id }, { $set: { title: `${randomMockIssue.issueKey}: ${pr.title}` } });
                  mapCount++;
              }
          }
          logger.info(`Mapped ${mapCount} Pull Requests to Jira issues for ${org.name}.`);
      } else {
         logger.warn(`No PullRequests found in database to map mock Jira issues to for ${org.name}.`);
      }
    }

    logger.info('Seed completed successfully!');
    process.exit(0);

  } catch (err) {
    logger.error('Failed to seed Jira data', { error: err });
    process.exit(1);
  }
};

runSeed();
