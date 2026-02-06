import { ModuleMetadata } from '@nestjs/common/interfaces/modules/module-metadata.interface'
import { MetadataScanner } from '@nestjs/core/metadata-scanner'
import { TestingModuleOptions } from '@nestjs/testing'
import { TestingModuleBuilder } from './testing-module.builder'

/**
 * Custom Test class to use TestingModuleBuilder
 * instead of the default NestJS TestingModuleBuilder.
 */
export class Test {
  private static readonly metadataScanner = new MetadataScanner()

  public static createTestingModule(
    metadata: ModuleMetadata,
    options?: TestingModuleOptions,
  ) {
    return new TestingModuleBuilder(Test.metadataScanner, metadata, options)
  }
}
