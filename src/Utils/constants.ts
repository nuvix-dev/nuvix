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
export const APP_OPENSSL_KEY = (v?: string) => 'v1'; // _APP_OPENSSL_KEY_V1

export const APP_LIMIT_SUBSCRIBERS_SUBQUERY = 100;

export const API_KEY_STANDARD = 'standard';
export const API_KEY_DYNAMIC = 'dynamic';

export const PROJECT = Symbol('PROJECT');
export const PROJECT_USER = Symbol('PROJECT_USER');
export const DB_FOR_CONSOLE = Symbol('DBFORCONSOLE');
