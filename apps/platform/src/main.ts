/**
 * The main entry point for the Nuvix Platform application.
 * @author Nuvix-Tech
 * @version 1.0
 */
import { config } from 'dotenv'
import path from 'path'
config({
  path: [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.platform'),
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
