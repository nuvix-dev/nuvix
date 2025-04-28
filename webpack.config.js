const swcDefaultConfig =
  require('@nestjs/cli/lib/compiler/defaults/swc-defaults').swcDefaultsFactory()
    .swcOptions;

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
            // Ensure proper class inheritance handling
            jsc: {
              ...swcDefaultConfig.jsc,
              parser: {
                ...swcDefaultConfig.jsc.parser,
                decorators: true,
              },
              transform: {
                ...swcDefaultConfig.jsc.transform,
                legacyDecorator: true,
                decoratorMetadata: true,
              },
              target: "es2020", // Modern target for better support of class inheritance
              keepClassNames: true, // Important for NestJS dependency injection
            },
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  // Enable source maps for debugging
  devtool: 'source-map',
  target: 'node',
};
