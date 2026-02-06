import * as fs from 'node:fs'
import path from 'node:path'
import { PluginMetadataGenerator } from '@nestjs/cli/lib/compiler/plugins/plugin-metadata-generator.js'
import { ReadonlyVisitor } from '@nestjs/swagger/dist/plugin/visitors/readonly.visitor.js'

const outputFile = path.resolve('src/metadata.ts')

const generator = new PluginMetadataGenerator()
generator.generate({
  visitors: [
    new ReadonlyVisitor({
      dtoFileNameSuffix: ['.dto.ts', '.model.ts'],
      classTransformerShim: true,
      classValidatorShim: true,
      introspectComments: true,
      pathToSource: 'src',
      esmCompatible: true,
    }),
  ],
  outputDir: 'src',
  watch: false,
  tsconfigPath: 'tsconfig.app.json',
})

// --- Post-process step ---
let content = fs.readFileSync(outputFile, 'utf8')

// Replace `.bun/@nuvix+db@<any_version>/node_modules/@nuvix/db` with clean `@nuvix/db`
// Replace `@nuvix/db/dist` with clean `@nuvix/db`
content = content
  .replace(/\.bun\/@nuvix\+db@[^/]+\/node_modules\/@nuvix\/db\//g, '@nuvix/db/')
  .replace(/\.bun\/@nuvix\+db@[^/]+\/node_modules\/@nuvix\/db\b/g, '@nuvix/db')
  .replace(/@nuvix\/db\/dist\//g, '@nuvix/db/')
  .replace(/@nuvix\/db\/dist\b/g, '@nuvix/db')

fs.writeFileSync(outputFile, content, 'utf8')
console.log(`✔ Metadata imports cleaned: ${outputFile}`)
