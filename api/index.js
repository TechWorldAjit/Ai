import { app } from '../server/index.js';
import { connectDB } from '../server/db/connection.js';
import { ensureIndexes } from '../server/db/indexes.js';

let isDbConnected = false;

export default async function handler(req, res) {
  if (!isDbConnected) {
    try {
      const { db } = await connectDB();
      await ensureIndexes(db);
      isDbConnected = true;
    } catch (err) {
      console.error('[Vercel Serverless] Database connection error:', err);
    }
  }

  return app(req, res);
}
