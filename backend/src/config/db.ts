import mongoose from 'mongoose';
import { env } from './env';

let databaseConnected = false;

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
    databaseConnected = true;
    console.log(`[db] connected to MongoDB database "${mongoose.connection.name}"`);
  } catch (error) {
    databaseConnected = false;
    console.error(
      '[db] MongoDB connection failed — the API will start but database-backed endpoints will be unavailable. ' +
        'Check MONGODB_URI and credentials.',
      error instanceof Error ? error.message : error
    );
  }
}

export function isDatabaseConnected(): boolean {
  return databaseConnected;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  databaseConnected = false;
}
