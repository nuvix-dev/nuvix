import { config } from 'dotenv';

config();

export const JWT_SECRET = process.env.JWT_SECRET
export const PYTHON_API_URL = process.env.PYTHON_API_URL
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export const APP_VERSION_STABLE = '1.0.0';
export const APP_LIMIT_USER_SESSIONS_DEFAULT = 10;

export const API_KEY_STANDARD = 'standard';
export const API_KEY_DYNAMIC = 'dynamic';

export const PROJECT = Symbol('PROJECT');