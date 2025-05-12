class InjectCreateRequirePlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('InjectCreateRequirePlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'InjectCreateRequirePlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        (assets) => {
          for (const assetName of Object.keys(assets)) {
            if (assetName.endsWith('.mjs') && !assetName.endsWith('.min.mjs')) {
              const asset = compilation.getAsset(assetName);
              let source = asset.source.source();

              // Avoid duplicate injection
              if (!source.includes('nuvixRequire')) {
                const injectCode = [
                  `import { createRequire as nuvixRequire } from 'module';`,
                  `const require = nuvixRequire(import.meta.url);`,
                  ``,
                ].join('\n');

                const newSource = injectCode + source;

                compilation.updateAsset(
                  assetName,
                  new compiler.webpack.sources.RawSource(newSource)
                );
              }
            }
          }
        }
      );
    });
  }
}

module.exports = InjectCreateRequirePlugin;
