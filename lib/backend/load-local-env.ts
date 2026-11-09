import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const isLocalRuntime = process.env.VERCEL_ENV === 'development'
  || (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production');

if (isLocalRuntime) {
  const localEnvPath = resolve(process.cwd(), '.env.local');
  if (existsSync(localEnvPath)) {
    process.loadEnvFile(localEnvPath);
  }
}
