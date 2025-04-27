import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'libs/utils/src/index.ts',
    output: {
        dir: 'dist/libs/utils',
        format: 'esm',
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: 'libs/utils/src'
    },
    plugins: [
        resolve({
            extensions: ['.js', '.ts'],
            preferBuiltins: true,
        }),
        commonjs(),
        // typescript({
        //     tsconfig: 'libs/utils/tsconfig.lib.json',
        //     declaration: true,
        //     declarationDir: 'dist/libs/utils/types'
        // })
    ],
    external: [
        "express",
        "@nestjs/common",
        "@nestjs/core",
        "@nestjs/platform-express",
        "@nestjs/*",
        "reflect-metadata",
        "rxjs",
        "fs",
        "path",
        "crypto",
        "os"
    ]
};
