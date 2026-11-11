import dotenv from 'dotenv';
import path from 'path';

// Load backend/.env regardless of the current working directory.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Comma-separated list of allowed web origins (Vercel domain + localhost for
  // dev). Native mobile requests send no Origin header and are always allowed.
  // Precedence:
  //   CORS_ORIGINS  -> explicit origin list (recommended for production).
  //   CORS_ORIGIN   -> legacy single value; '*' is treated as "allow all" so a
  //                    stale wildcard from an older deploy still works instead of
  //                    silently blocking every origin.
  //   (unset)       -> localhost dev origins.
  corsOrigins: (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:8081,http://localhost:19006')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
};
