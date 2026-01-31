import {
  Controller,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ResponseInterceptor } from '@nuvix/core/resolvers'
import { AttributesService } from './attributes.service'
import { ProjectGuard } from '@nuvix/core/resolvers'
import { Models } from '@nuvix/core/helpers'
import type { Database, Query as Queries } from '@nuvix/db'
import { CurrentDatabase, Project } from '@nuvix/core/decorators'
import {
  Auth,
  AuthType,
  CurrentSchemaType,
  Namespace,
  QueryFilter,
} from '@nuvix/core/decorators'

// DTOs
import {
  AttributeParamsDTO,
  CreateBooleanAttributeDTO,
  CreateDatetimeAttributeDTO,
  CreateEmailAttributeDTO,
  CreateEnumAttributeDTO,
  CreateFloatAttributeDTO,
  CreateIntegerAttributeDTO,
  CreateIpAttributeDTO,
  CreateRelationAttributeDTO,
  CreateStringAttributeDTO,
  CreateURLAttributeDTO,
  UpdateBooleanAttributeDTO,
  UpdateDatetimeAttributeDTO,
  UpdateEmailAttributeDTO,
  UpdateEnumAttributeDTO,
  UpdateFloatAttributeDTO,
  UpdateIntegerAttributeDTO,
  UpdateIpAttributeDTO,
  UpdateRelationAttributeDTO,
  UpdateStringAttributeDTO,
  UpdateURLAttributeDTO,
} from './DTO/attributes.dto'
import { ApiInterceptor } from '@nuvix/core/resolvers'
import { SchemaGuard } from '@nuvix/core/resolvers'
import type { AttributesDoc, ProjectsDoc } from '@nuvix/utils/types'
import { AttributesQueryPipe } from '@nuvix/core/pipes/queries'
import { Delete, Get, Patch, Post } from '@nuvix/core'
import { CollectionParamsDTO } from '../DTO/collection.dto'
import { IListResponse, IResponse, SchemaType } from '@nuvix/utils'

@Controller({
  version: ['1'],
  path: 'schemas/:schemaId/collections/:collectionId/attributes',
})
@Namespace('schemas')
@UseGuards(ProjectGuard, SchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.KEY])
@CurrentSchemaType(SchemaType.Document)
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get('', {
    summary: 'List attributes',
    scopes: ['collections.read', 'attributes.read'],
    model: { type: Models.ATTRIBUTE, list: true },
    sdk: {
      name: 'listAttributes',
      descMd: '/docs/references/schemas/collections/list-attributes.md',
    },
  })
  async findAttributes(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @QueryFilter(AttributesQueryPipe) queries?: Queries[],
  ): Promise<IListResponse<AttributesDoc>> {
    return this.attributesService.getAttributes(db, collectionId, queries)
  }

  @Post('string', {
    summary: 'Create string attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_STRING,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createStringAttribute',
      descMd: '/docs/references/schemas/collections/create-string-attribute.md',
      code: 202,
    },
  })
  async createStringAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateStringAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createStringAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Post('email', {
    summary: 'Create email attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_EMAIL,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createEmailAttribute',
      descMd: '/docs/references/schemas/collections/create-email-attribute.md',
      code: 202,
    },
  })
  async createEmailAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateEmailAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createEmailAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Post('enum', {
    summary: 'Create enum attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_ENUM,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createEnumAttribute',
      descMd: '/docs/references/schemas/collections/create-attribute-enum.md',
      code: 202,
    },
  })
  async createEnumAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateEnumAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createEnumAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Post('ip', {
    summary: 'Create IP address attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_IP,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createIpAttribute',
      descMd: '/docs/references/schemas/collections/create-ip-attribute.md',
      code: 202,
    },
  })
  async createIpAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateIpAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createIPAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Post('url', {
    summary: 'Create URL attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_URL,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createUrlAttribute',
      descMd: '/docs/references/schemas/collections/create-url-attribute.md',
      code: 202,
    },
  })
  async createUrlAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateURLAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createURLAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Post('integer', {
    summary: 'Create integer attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_INTEGER,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createIntegerAttribute',
      descMd:
        '/docs/references/schemas/collections/create-integer-attribute.md',
      code: 202,
    },
  })
  async createIntegerAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateIntegerAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createIntegerAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Post('float', {
    summary: 'Create float attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_FLOAT,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createFloatAttribute',
      descMd: '/docs/references/schemas/collections/create-float-attribute.md',
      code: 202,
    },
  })
  async createFloatAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateFloatAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createFloatAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Post('boolean', {
    summary: 'Create boolean attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_BOOLEAN,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createBooleanAttribute',
      descMd:
        '/docs/references/schemas/collections/create-boolean-attribute.md',
      code: 202,
    },
  })
  async createBooleanAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateBooleanAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createBooleanAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Post(['datetime', 'timestamptz'], {
    summary: 'Create datetime attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_DATETIME,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createDatetimeAttribute',
      descMd:
        '/docs/references/schemas/collections/create-datetime-attribute.md',
      code: 202,
    },
  })
  async createDatetimeAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateDatetimeAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createDateAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Post('relationship', {
    summary: 'Create relationship attribute',
    scopes: ['collections.update', 'attributes.create'],
    model: Models.ATTRIBUTE_RELATIONSHIP,
    audit: {
      key: 'attribute.create',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'createRelationshipAttribute',
      descMd:
        '/docs/references/schemas/collections/create-relationship-attribute.md',
      code: 202,
    },
  })
  async createRelationAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId }: CollectionParamsDTO,
    @Body() createAttributeDTO: CreateRelationAttributeDTO,
    @Project() project: ProjectsDoc,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.createRelationshipAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    )
  }

  @Get(':key', {
    summary: 'Get attribute',
    scopes: ['collections.read', 'attributes.read'],
    model: Models.ATTRIBUTE,
    sdk: {
      name: 'getAttribute',
      descMd: '/docs/references/schemas/collections/get-attribute.md',
    },
  })
  async findAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.getAttribute(db, collectionId, key)
  }

  @Patch('string/:key', {
    summary: 'Update string attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_STRING,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateStringAttribute',
      descMd: '/docs/references/schemas/collections/update-string-attribute.md',
    },
  })
  async updateStringAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateStringAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateStringAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Patch('email/:key', {
    summary: 'Update email attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_EMAIL,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateEmailAttribute',
      descMd: '/docs/references/schemas/collections/update-email-attribute.md',
    },
  })
  async updateEmailAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateEmailAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateEmailAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Patch('enum/:key', {
    summary: 'Update enum attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_ENUM,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateEnumAttribute',
      descMd: '/docs/references/schemas/collections/update-enum-attribute.md',
    },
  })
  async updateEnumAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateEnumAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateEnumAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Patch('ip/:key', {
    summary: 'Update IP address attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_IP,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateIpAttribute',
      descMd: '/docs/references/schemas/collections/update-ip-attribute.md',
    },
  })
  async updateIpAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateIpAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateIPAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Patch('url/:key', {
    summary: 'Update URL attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_URL,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateUrlAttribute',
      descMd: '/docs/references/schemas/collections/update-url-attribute.md',
    },
  })
  async updateUrlAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateURLAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateURLAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Patch('integer/:key', {
    summary: 'Update integer attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_INTEGER,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateIntegerAttribute',
      descMd:
        '/docs/references/schemas/collections/update-integer-attribute.md',
    },
  })
  async updateIntegerAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateIntegerAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateIntegerAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Patch('float/:key', {
    summary: 'Update float attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_FLOAT,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateFloatAttribute',
      descMd: '/docs/references/schemas/collections/update-float-attribute.md',
    },
  })
  async updateFloatAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateFloatAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateFloatAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Patch('boolean/:key', {
    summary: 'Update boolean attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_BOOLEAN,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateBooleanAttribute',
      descMd:
        '/docs/references/schemas/collections/update-boolean-attribute.md',
    },
  })
  async updateBooleanAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateBooleanAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateBooleanAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Patch(['datetime/:key', 'timestamptz/:key'], {
    summary: 'Update DateTime attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_DATETIME,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateDatetimeAttribute',
      descMd:
        '/docs/references/schemas/collections/update-datetime-attribute.md',
    },
  })
  async updateDatetimeAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateDatetimeAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateDateAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Patch('relationship/:key', {
    summary: 'Update relationship attribute',
    scopes: ['collections.update', 'attributes.update'],
    model: Models.ATTRIBUTE_RELATIONSHIP,
    audit: {
      key: 'attribute.update',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'updateRelationshipAttribute',
      descMd:
        '/docs/references/schemas/collections/update-relationship-attribute.md',
    },
  })
  async updateRelationAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Body() updateAttributeDTO: UpdateRelationAttributeDTO,
  ): Promise<IResponse<AttributesDoc>> {
    return this.attributesService.updateRelationshipAttribute(
      db,
      collectionId,
      key,
      updateAttributeDTO,
    )
  }

  @Delete(':key', {
    summary: 'Delete attribute',
    scopes: ['collections.update', 'attributes.delete'],
    model: Models.ATTRIBUTE,
    audit: {
      key: 'attribute.delete',
      resource: 'schema/{params.schemaId}/collection/{params.collectionId}',
    },
    sdk: {
      name: 'deleteAttribute',
      descMd: '/docs/references/schemas/collections/delete-attribute.md',
      code: 202,
    },
  })
  async removeAttribute(
    @CurrentDatabase() db: Database,
    @Param() { collectionId, key }: AttributeParamsDTO,
    @Project() project: ProjectsDoc,
  ): Promise<AttributesDoc> {
    return this.attributesService.deleteAttribute(
      db,
      collectionId,
      key,
      project,
    )
  }
}
