import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'libs/pg-meta/src/index.ts',
    output: {
        dir: 'dist/libs/pg-meta',
        format: 'esm',
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: 'libs/pg-meta/src'
    },
    plugins: [
        resolve({
            extensions: ['.js', '.ts'],
            preferBuiltins: true,
        }),
        commonjs(),
        typescript({
            tsconfig: 'libs/pg-meta/tsconfig.lib.json',
            declaration: true,
            declarationDir: 'dist/libs/pg-meta/types'
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
        "pg",
        "pg-format",
        "pgsql-parser",
        "prettier-plugin-sql",
        "reflect-metadata",
        "rxjs",
        "@nuvix/core/*",
        "@nuvix/utils/*"
    ]
};
