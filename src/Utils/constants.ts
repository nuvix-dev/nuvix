import { config } from 'dotenv';

config();

export const JWT_SECRET = process.env.JWT_SECRET;
export const PYTHON_API_URL = process.env.PYTHON_API_URL;
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export const APP_VERSION_STABLE = '1.0.0';
export const APP_LIMIT_USER_SESSIONS_DEFAULT = 10;
export const APP_LIMIT_ARRAY_PARAMS_SIZE = 10;
export const APP_FUNCTION_SPECIFICATION_DEFAULT = 'default';
export const APP_LIMIT_SUBQUERY = 100;
export const APP_OPENSSL_KEY_1 = 'acd3462d9128abcd'; // 16-byte key for AES-128-GCM

export const APP_LIMIT_SUBSCRIBERS_SUBQUERY = 100;

export const APP_MAX_COUNT = 1000000;
export const APP_LIMIT_COUNT = 100000000;

export const API_KEY_STANDARD = 'standard';
export const API_KEY_DYNAMIC = 'dynamic';

export const PROJECT = Symbol('PROJECT');
export const USER = Symbol('USER');
export const DB_FOR_CONSOLE = Symbol('DbForConsole');
export const DB_FOR_PROJECT = Symbol('DbForProject');
export const GEO_DB = Symbol('GeoDb');
export const IS_PUBLIC_KEY = Symbol('isPublic');

export const CONSOLE_CONFIG: any = {
  auths: {},
};
