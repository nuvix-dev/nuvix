// pm2.config.js
module.exports = {
    apps: [
        {
            name: 'nuvix-api',
            script: 'dist/apps/nuvix/main.js',
            watch: false,
            instances: 'max', // Use 'max' to scale across all available CPU cores
            exec_mode: 'cluster', // Use 'cluster' for multi-core scaling
            env: {
                NODE_ENV: 'production',
                PORT: 4000,
            },
        },
        {
            name: 'nuvix-console',
            script: 'dist/apps/console/main.js',
            watch: false,
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 4100,
            },
        },
    ],
};
