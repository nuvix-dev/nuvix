#!/usr/bin/env node

/**
 * Simple CLI for common Turborepo tasks
 */

import { execSync } from 'child_process';
import path from 'path';

const commands = {
  build: {
    description: 'Build all packages',
    command: 'turbo build',
  },
  dev: {
    description: 'Start development mode for all packages',
    command: 'turbo dev',
  },
  lint: {
    description: 'Lint all packages',
    command: 'turbo lint',
  },
  test: {
    description: 'Test all packages',
    command: 'turbo test',
  },
  typecheck: {
    description: 'Type check all packages',
    command: 'turbo typecheck',
  },
  clean: {
    description: 'Clean all build artifacts',
    command: 'turbo clean && rm -rf node_modules/.cache && rm -rf .turbo',
  },
  'build:libs': {
    description: 'Build only libraries',
    command: 'turbo build --filter="@nuvix/*"',
  },
  'build:apps': {
    description: 'Build only applications',
    command: 'turbo build --filter="./apps/*"',
  },
  'dev:api': {
    description: 'Start development mode for API app',
    command: 'turbo dev --filter="api"',
  },
  'dev:console': {
    description: 'Start development mode for Console app',
    command: 'turbo dev --filter="platform"',
  },
};

function runCommand(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  } catch (error) {
    console.error(`Error running command: ${cmd}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log('Nuvix Turborepo CLI\n');
  console.log('Available commands:');
  Object.entries(commands).forEach(([name, { description }]) => {
    console.log(`  ${name.padEnd(15)} ${description}`);
  });
  console.log('\nUsage: npm run cli <command>');
}

const [, , command] = process.argv;

if (
  !command ||
  command === 'help' ||
  command === '-h' ||
  command === '--help'
) {
  showHelp();
  process.exit(0);
}

if (commands[command]) {
  console.log(`Running: ${commands[command].command}`);
  runCommand(commands[command].command);
} else {
  console.error(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}
