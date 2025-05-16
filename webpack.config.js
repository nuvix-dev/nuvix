const InjectCreateRequirePlugin = require('./scripts/InjectCreateRequirePlugin');
const swcDefaultConfig = require('@nestjs/cli/lib/compiler/defaults/swc-defaults').swcDefaultsFactory().swcOptions;

function printStylizedNuvix() {
  const name = `
███╗   ██╗██╗   ██╗██╗   ██╗██╗██╗  ██╗
████╗  ██║██║   ██║██║   ██║██║╚██╗██╔╝
██╔██╗ ██║██║   ██║██║   ██║██║ ╚███╔╝ 
██║╚██╗██║██║   ██║╚██╗ ██╔╝██║ ██╔██╗ 
██║ ╚████║╚██████╔╝ ╚████╔╝ ██║██╔╝ ██╗
╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝╚═╝  ╚═╝
  `;

  console.log('\x1b[93m' + name + '\x1b[0m');
}


/**
 * @type {import('webpack').Configuration}
 * @param {import('webpack').Configuration} options
 */
module.exports = (options) => {
  if (process.env.NODE_ENV !== 'production') {
    printStylizedNuvix();
  }
  return {
    ...options,
    output: {
      ...options.output,
      filename: options.output.filename.replace(/\.js$/, '.mjs'),
    },
    target: 'node16',
    experiments: {
      outputModule: true,
    },
    module: {
      ...options.module,
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'swc-loader',
              options: {
                ...swcDefaultConfig,
                jsc: {
                  ...swcDefaultConfig.jsc,
                  target: 'es2023',
                },
                module: {
                  type: 'es6',
                  ignoreDynamic: true,
                  resolveFully: true,
                  noInterop: false,
                  preserveImportMeta: true,
                },
                minify: false,
                sourceMaps: true,
              },
            },
          ],
        },
      ],
    },
    plugins: [
      ...options.plugins,
      new InjectCreateRequirePlugin(),
    ]
  }
};