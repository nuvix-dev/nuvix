const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = (env) => {
    const mode = env.NODE_ENV || 'production';
    console.log(`Building in ${mode} mode, with source maps enabled`);

    return {
        mode,
        output: {
            path: join(__dirname, '../../dist/apps/nuvix'),
        },
        plugins: [
            new NxAppWebpackPlugin({
                target: 'node',
                compiler: 'swc',
                main: './src/main.ts',
                tsConfig: './tsconfig.app.json',
                optimization: false,
                outputHashing: 'none',
                additionalOptions: {
                    sourceMap: true,
                },
                externalDependencies: "all",
            })
        ],
    };
};