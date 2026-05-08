import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Org from '../models/Organisation.js';
import JiraIssue from '../models/JiraIssue.js';

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/prsentinel');
        const orgs = await Org.find();
        console.error("Orgs Count:", orgs.length);
        for (const org of orgs) {
            const issues = await JiraIssue.countDocuments({ orgId: org._id });
            console.error(`Org ID: ${org._id}, Name: ${org.name}, JiraIssues: ${issues}`);
        }
        const users = await User.find();
        for (const user of users) {
            console.error(`User: ${user.email}, org: ${user.orgId}`);
        }
    } catch(e) {
        console.error("Error", e);
    }
    process.exit(0);
}
run();
