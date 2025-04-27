import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'apps/console/src/main.ts',
    output: {
        dir: 'dist/apps/console',
        format: 'esm',
        sourcemap: true,
        entryFileNames: '[name].js'
    },
    plugins: [
        resolve({
            extensions: ['.js', '.ts'],
            preferBuiltins: true,
        }),
        commonjs(),
        typescript({
            tsconfig: 'apps/console/tsconfig.app.json',
        })
    ],
    external: [
        "express",
        "@nestjs/common",
        "@nestjs/core",
        "@nestjs/platform-express",
        "@nestjs/microservices",
        "@nestjs/websockets",
        "@nestjs/graphql", 
        "@nestjs/*",
        "@fastify/*",
        "@apollo/*",
        "argon2",
        "axios",
        "bcrypt",
        "canvas",
        "class-transformer",
        "class-validator",
        "dotenv",
        "graphql",
        "handlebars",
        "maxmind",
        "mysql2",
        "nodemailer",
        "otplib",
        "pg",
        "pg-format",
        "pgsql-parser",
        "prettier-plugin-sql",
        "qs",
        "reflect-metadata",
        "rxjs",
        "sharp",
        "sprintf-js",
        "ua-parser-js",
        "ts-morph",
        "@nuvix/core/*",
        "@nuvix/utils/*",
        "@nuvix/pg-meta/*"
    ]
};
