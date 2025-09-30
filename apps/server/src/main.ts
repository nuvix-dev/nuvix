/**
 * Nuvix is a Open Source Backend that allows you to create a backend for your application in minutes.
 * This file is the entry point of the application, where the application is created and started.
 * @author Nuvix-Tech
 * @version 1.0
 * @beta
 */
import { config } from 'dotenv'
import path from 'path'
config({
  path: [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.api'),
  ],
})

import { bootstrap } from './bootstrap.js'
bootstrap()
