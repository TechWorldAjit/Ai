import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'global_ai_directory';

if (!uri) {
  console.error('FATAL: MONGO_URI is not set in environment variables.');
}

let client = null;
let db = null;

export async function connectDB() {
  if (db && client) {
    return { client, db };
  }

  try {
    client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
    });

    await client.connect();
    db = client.db(dbName);
    console.log(`[Database] Connected successfully to MongoDB (Database: ${dbName})`);
    return { client, db };
  } catch (err) {
    console.error('[Database] Connection failed:', err.message);
    throw err;
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[Database] Connection closed.');
  }
}

