import { parse } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const loadEnvFile = envPath => {
  const fullPath = resolve(process.cwd(), envPath);
  try {
    if (existsSync(fullPath)) {
      console.log(`Loading environment from ${envPath}`);
      return parse(readFileSync(fullPath));
    }
    console.warn(`Environment file ${envPath} not found, using defaults`);
    return {};
  } catch (error) {
    console.error(`Error loading ${envPath}: ${error.message}`);
    return {};
  }
};

const shared = loadEnvFile('.env');
const api = loadEnvFile('.env.api');
const consoleEnv = loadEnvFile('.env.platform');
const extra = import.meta.env;

export const apps = [
  {
    name: 'nuvix-api',
    script: 'dist/api/main.js',
    watch: false,
    instances: 2, // `max` Scale to use all available CPUs
    exec_mode: 'cluster',
    autorestart: true,
    interpreter: 'bun',
    max_memory_restart: '2G', // Restart if memory exceeds 2GB
    env: {
      ...extra,
      ...shared,
      ...api,
      NODE_ENV: 'production',
    },
    merge_logs: true,
    error_file: 'logs/nuvix-api-error.log',
    out_file: 'logs/nuvix-api-out.log',
  },
  {
    name: 'nuvix-platform',
    script: 'dist/platform/main.js',
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    interpreter: 'bun',
    autorestart: true,
    max_memory_restart: '1G', // Restart if memory exceeds 1GB
    env: {
      ...extra,
      ...shared,
      ...consoleEnv,
      NODE_ENV: 'production',
    },
    merge_logs: true,
    error_file: 'logs/nuvix-platform-error.log',
    out_file: 'logs/nuvix-platform-out.log',
  },
];
