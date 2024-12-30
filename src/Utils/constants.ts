import {config} from 'dotenv';

config();

export const JWT_SECRET = process.env.JWT_SECRET
export const PYTHON_API_URL = process.env.PYTHON_API_URL