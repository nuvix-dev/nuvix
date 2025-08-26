import { PluginMetadataGenerator } from '@nestjs/cli/lib/compiler/plugins/plugin-metadata-generator';
import { ReadonlyVisitor } from '@nestjs/swagger/dist/plugin';

const generator = new PluginMetadataGenerator();
generator.generate({
  visitors: [
    new ReadonlyVisitor({
      classTransformerShim: true,
      classValidatorShim: true,
      introspectComments: true,
      pathToSource: __dirname,
    }),
  ],
  outputDir: __dirname,
  watch: false,
  tsconfigPath: 'apps/api/tsconfig.app.json',
});
