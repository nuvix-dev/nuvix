const swcDefaultConfig =
  require('@nestjs/cli/lib/compiler/defaults/swc-defaults').swcDefaultsFactory()
    .swcOptions;

/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            ...swcDefaultConfig,
            sourceMaps: true,
            minify: true,
          },
        },
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
};
