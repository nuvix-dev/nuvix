// pm2.config.js
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables with error handling
const loadEnvFile = (path) => {
    try {
        return fs.existsSync(path) ? dotenv.parse(fs.readFileSync(path)) : {};
    } catch (error) {
        console.error(`Error loading ${path}: ${error.message}`);
        return {};
    }
};

// Load configurations with fallbacks
const shared = loadEnvFile('.env');
const api = { ...loadEnvFile('.env.api') };
const console = { ...loadEnvFile('.env.console') };

module.exports = {
    apps: [
        {
            name: 'nuvix-api',
            script: 'dist/apps/nuvix/main.js',
            watch: false,
            instances: 2, // Use 'max' to scale across all available CPU cores
            exec_mode: 'cluster', // Use 'cluster' for multi-core scaling
            env: {
                ...shared,
                ...api,
                NODE_ENV: 'production',
            },
        },
        {
            name: 'nuvix-console',
            script: 'dist/apps/console/main.js',
            watch: false,
            instances: 1,
            exec_mode: 'fork',
            env: {
                ...shared,
                ...console,
                NODE_ENV: 'production',
            },
        },
    ],
};
