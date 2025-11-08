/**
 * Nuvix is a Open Source Backend that allows you to create a backend for your application in minutes.
 * This file is the entry point of the application, where the application is created and started.
 * @author Nuvix-Tech
 * @version 0.1.0
 * @alpha
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
import {
  configureDbFiltersAndFormats,
  configurePgTypeParsers,
} from '@nuvix/core'
configurePgTypeParsers()
configureDbFiltersAndFormats()
bootstrap()
