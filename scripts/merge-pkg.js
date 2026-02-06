#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'trustedDependencies']

/**
 * Loads and parses a package.json file from the given file path.
 * @param {string} filePath The absolute path to the package.json file.
 * @returns {object} The parsed package.json object.
 */
function loadPkg(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Package file not found: ${filePath}`)
  }
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

/**
 * Merges dependencies from a source package object into a base package object.
 * Handles conflicts by logging a warning.
 * @param {object} base The package.json object to merge into.
 * @param {object} source The package.json object to merge from.
 */
function mergeDeps(base, source) {
  for (const field of DEP_FIELDS) {
    if (!source[field]) {
      continue
    }
    if (field === 'trustedDependencies') {
      base[field] = base[field] || []
      base[field].push(...source[field])
    } else {
      base[field] = base[field] || {}
      for (const [name, version] of Object.entries(source[field])) {
        if (typeof version === 'string' && version.startsWith('workspace:')) {
          continue // Skip internal workspace dependencies
        }
        if (base[field][name] && base[field][name] !== version) {
          console.warn(
            `⚠️ Conflict for ${name}: versions '${base[field][name]}' vs '${version}'. Using base version.`,
          )
        }
        // If the dependency is not already defined, add it. Otherwise, keep the base version.
        if (!base[field][name]) {
          base[field][name] = version
        }
      }
    }
  }
}

/**
 * Checks if a dependency version string is a workspace reference.
 * @param {any} version The version string to check.
 * @returns {boolean} True if it's a workspace dependency, false otherwise.
 */
function isWorkspaceDep(version) {
  return typeof version === 'string' && version.startsWith('workspace:')
}

/**
 * Resolves the absolute path to a workspace library's package.json.
 * @param {string} pkgName The name of the workspace package.
 * @returns {string | null} The absolute path to the package.json, or null if not found.
 */
function resolveLibPath(pkgName) {
  const dir = pkgName.replace(/^@[^/]+\//, '')
  const libPath = path.join(__dirname, `../libs/${dir}/package.json`)
  return existsSync(libPath) ? libPath : null
}

/**
 * Recursively collects and merges external dependencies from internal workspace libraries.
 * @param {object} pkg The package.json object to analyze.
 * @param {Set<string>} visited A set to keep track of visited packages to prevent infinite loops.
 */
function collectLibDeps(pkg, visited = new Set()) {
  for (const field of ['devDependencies']) {
    if (!pkg[field]) {
      continue
    }

    for (const [dep, version] of Object.entries(pkg[field])) {
      if (!isWorkspaceDep(version)) {
        continue
      }
      if (visited.has(dep)) {
        continue
      }

      const libPkgPath = resolveLibPath(dep)
      if (!libPkgPath) {
        console.warn(`⚠️ Could not resolve workspace lib '${dep}'.`)
        continue
      }

      visited.add(dep)
      const libPkg = loadPkg(libPkgPath)

      // Merge external deps of this lib into the main package
      mergeDeps(pkg, libPkg)

      // Recursively check for nested libs
      collectLibDeps(libPkg, visited)
    }
  }
}

/**
 * Prepares a deploy-ready package.json for a given application.
 * @param {string} appName The name of the application.
 */
async function prepareDeploy(appName) {
  console.log(`✨ Preparing deploy package.json for '${appName}'...`)

  try {
    const appPkgPath = path.join(__dirname, `../apps/${appName}/package.json`)
    const mainPkgPath = path.join(__dirname, '../package.json')
    const appPkg = loadPkg(appPkgPath)
    const mainPkg = loadPkg(mainPkgPath)

    // Start with a shallow clone, keeping essential fields.
    const finalPkg = {
      name: appPkg.name,
      version: appPkg.version,
      private: false,
      type: appPkg.type,
      main: appPkg.main,
      module: appPkg.module,
      scripts:
        appPkg.scripts?.start || appPkg.scripts?.build
          ? { start: appPkg.scripts.start || 'node main.js' }
          : undefined,
      dependencies: {},
    }

    mergeDeps(finalPkg, mainPkg)
    // First, merge the app's direct dependencies
    mergeDeps(finalPkg, appPkg)

    // Recursively collect dependencies from internal libraries
    collectLibDeps(appPkg)

    // Merge again to bring the newly collected deps into the final package
    mergeDeps(finalPkg, appPkg)

    finalPkg.trustedDependencies = Array.isArray(finalPkg.trustedDependencies)
      ? Array.from(new Set(finalPkg.trustedDependencies))
      : []

    const outDir = path.join(__dirname, `../dist/${appName}`)
    if (!existsSync(outDir)) {
      // Create the output directory if it doesn't exist
      await fs.mkdir(outDir, { recursive: true })
    }

    const outPath = path.join(outDir, 'package.json')
    writeFileSync(outPath, JSON.stringify(finalPkg, null, 2))
    console.log(`✅ Deploy-ready package.json written to ${outPath}`)
  } catch (error) {
    console.error(`❌ Error preparing deploy for '${appName}':`, error.message)
    process.exit(1)
  }
}

/**
 * Main function to handle command-line execution.
 */
async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Usage: prepare-deploy <app-name1> <app-name2>...')
    process.exit(1)
  }

  for (const appName of args) {
    await prepareDeploy(appName)
  }
}

// Execute the main function
main()
