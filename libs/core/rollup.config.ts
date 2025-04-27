import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'libs/core/src/index.ts',
    output: {
        dir: 'dist/libs/core',
        format: 'esm',
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: 'libs/core/src'
    },
    plugins: [
        resolve({
            extensions: ['.js', '.ts'],
            preferBuiltins: true,
        }),
        commonjs(),
        typescript({
            tsconfig: 'libs/core/tsconfig.lib.json',
            declaration: true,
            declarationDir: 'dist/libs/core/types'
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
        "ts-morph"
    ]
};
