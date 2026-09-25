import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log(`[db] connected to MongoDB database "${mongoose.connection.name}"`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
