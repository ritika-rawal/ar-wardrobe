import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

/**
 * Connect to MongoDB.
 *
 * Strategy (zero-config friendly for demos):
 *   1. If MONGO_URI is set in the environment, connect to that (local Mongo or Atlas).
 *   2. Otherwise, spin up an in-memory MongoDB via mongodb-memory-server so the
 *      app runs with NOTHING installed. Data is persisted to MEMORY_DB_PATH so it
 *      survives restarts during a demo.
 *
 * This keeps the codebase "real MongoDB + Mongoose" while remaining trivial to run.
 */
export async function connectDB() {
  const uri = (process.env.MONGO_URI || '').trim();

  if (uri) {
    await mongoose.connect(uri);
    console.log(`[db] Connected to MongoDB at ${uri.replace(/\/\/.*@/, '//***@')}`);
    return { mode: 'external' };
  }

  // No URI provided -> use in-memory MongoDB (dev/demo default).
  const { MongoMemoryServer } = await import('mongodb-memory-server');

  const dbPath = path.resolve(process.env.MEMORY_DB_PATH || './.memory-db');
  if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

  const mongod = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: 'wiredTiger', dbName: 'virtual-wardrobe' },
  });

  const memUri = mongod.getUri('virtual-wardrobe');
  await mongoose.connect(memUri);
  console.log('[db] Connected to in-memory MongoDB (no install needed).');
  console.log(`[db] Data persisted at ${dbPath}`);

  // Stop the in-memory server cleanly on shutdown.
  const shutdown = async () => {
    try {
      await mongoose.disconnect();
      await mongod.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { mode: 'memory', mongod };
}
