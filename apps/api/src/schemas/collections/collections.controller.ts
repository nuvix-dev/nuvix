import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
  Put,
} from '@nestjs/common';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { CollectionsService } from './collections.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import { Models } from '@nuvix/core/helper/response.helper';
import type { Database, Doc, Query as Queries } from '@nuvix-tech/db';
import { Mode } from '@nuvix/core/decorators/mode.decorator';
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import {
  CurrentDatabase,
  Project,
} from '@nuvix/core/decorators/project.decorator';
import { ResModel } from '@nuvix/core/decorators';

// DTOs
import { CreateCollectionDTO, UpdateCollectionDTO } from './DTO/collection.dto';
import {
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
} from './DTO/attributes.dto';
import { CreateDocumentDTO, UpdateDocumentDTO } from './DTO/document.dto';
import { CreateIndexDTO } from './DTO/indexes.dto';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import { DocSchemaGuard } from '@nuvix/core/resolvers/guards';
import type { ProjectsDoc } from '@nuvix/utils/types';

@Controller({ version: ['1'], path: 'schemas/:schemaId/collections' })
@UseGuards(ProjectGuard, DocSchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ResModel({ type: Models.COLLECTION, list: true })
  async findCollections(
    @CurrentDatabase() db: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return this.collectionsService.getCollections(db, queries, search);
  }

  @Post()
  @ResModel(Models.COLLECTION)
  async createCollection(
    @CurrentDatabase() db: Database,
    @Body() createCollectionDTO: CreateCollectionDTO,
  ) {
    return this.collectionsService.createCollection(
      db,
      createCollectionDTO,
    );
  }

  @Get(':collectionId/usage')
  @ResModel(Models.USAGE_COLLECTION)
  async getCollectionUsage(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('range') range?: string,
  ) {
    return this.collectionsService.getCollectionUsage(
      db,
      collectionId,
      range,
    );
  }

  @Get(':collectionId')
  @ResModel(Models.COLLECTION)
  async findCollection(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
  ) {
    return this.collectionsService.getCollection(db, collectionId);
  }

  @Get(':collectionId/logs')
  @ResModel({ type: Models.LOG, list: true })
  async findCollectionLogs(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return this.collectionsService.getCollectionLogs(
      db,
      collectionId,
      queries,
    );
  }

  @Put(':collectionId')
  @ResModel(Models.COLLECTION)
  async updateCollection(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() updateCollectionDTO: UpdateCollectionDTO,
  ) {
    return this.collectionsService.updateCollection(
      db,
      collectionId,
      updateCollectionDTO,
    );
  }

  @Delete(':collectionId')
  @ResModel(Models.NONE)
  async removeCollection(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.removeCollection(
      db,
      collectionId,
      project,
    );
  }

  @Get(':collectionId/documents')
  @ResModel({ type: Models.DOCUMENT, list: true })
  async findDocuments(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return this.collectionsService.getDocuments(
      db,
      collectionId,
      queries,
    );
  }

  @Get(':collectionId/attributes')
  @ResModel({ type: Models.ATTRIBUTE, list: true })
  async findAttributes(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return this.collectionsService.getAttributes(
      db,
      collectionId,
      queries,
    );
  }

  @Post(':collectionId/attributes/string')
  @ResModel(Models.ATTRIBUTE_STRING)
  async createStringAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateStringAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createStringAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post(':collectionId/attributes/email')
  @ResModel(Models.ATTRIBUTE_EMAIL)
  async createEmailAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateEmailAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createEmailAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post(':collectionId/attributes/enum')
  @ResModel(Models.ATTRIBUTE_ENUM)
  async createEnumAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateEnumAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createEnumAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post(':collectionId/attributes/ip')
  @ResModel(Models.ATTRIBUTE_IP)
  async createIpAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateIpAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createIPAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post(':collectionId/attributes/url')
  @ResModel(Models.ATTRIBUTE_URL)
  async createUrlAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateURLAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createURLAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post(':collectionId/attributes/integer')
  @ResModel(Models.ATTRIBUTE_INTEGER)
  async createIntegerAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateIntegerAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createIntegerAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post(':collectionId/attributes/float')
  @ResModel(Models.ATTRIBUTE_FLOAT)
  async createFloatAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateFloatAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createFloatAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post(':collectionId/attributes/boolean')
  @ResModel(Models.ATTRIBUTE_BOOLEAN)
  async createBooleanAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateBooleanAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createBooleanAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post(':collectionId/attributes/datetime')
  @ResModel(Models.ATTRIBUTE_DATETIME)
  async createDatetimeAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateDatetimeAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createDateAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post(':collectionId/attributes/relationship')
  @ResModel(Models.ATTRIBUTE_RELATIONSHIP)
  async createRelationAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateRelationAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createRelationshipAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Get(':collectionId/attributes/:attributeId')
  @ResModel(Models.ATTRIBUTE)
  async findAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
  ) {
    return this.collectionsService.getAttribute(
      db,
      collectionId,
      attributeId,
    );
  }

  @Patch(':collectionId/attributes/string/:attributeId')
  @ResModel(Models.ATTRIBUTE_STRING)
  async updateStringAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateStringAttributeDTO,
  ) {
    return this.collectionsService.updateStringAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch(':collectionId/attributes/email/:attributeId')
  @ResModel(Models.ATTRIBUTE_EMAIL)
  async updateEmailAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateEmailAttributeDTO,
  ) {
    return this.collectionsService.updateEmailAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch(':collectionId/attributes/enum/:attributeId')
  @ResModel(Models.ATTRIBUTE_ENUM)
  async updateEnumAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateEnumAttributeDTO,
  ) {
    return this.collectionsService.updateEnumAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch(':collectionId/attributes/ip/:attributeId')
  @ResModel(Models.ATTRIBUTE_IP)
  async updateIpAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateIpAttributeDTO,
  ) {
    return this.collectionsService.updateIPAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch(':collectionId/attributes/url/:attributeId')
  @ResModel(Models.ATTRIBUTE_URL)
  async updateUrlAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateURLAttributeDTO,
  ) {
    return this.collectionsService.updateURLAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch(':collectionId/attributes/integer/:attributeId')
  @ResModel(Models.ATTRIBUTE_INTEGER)
  async updateIntegerAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateIntegerAttributeDTO,
  ) {
    return this.collectionsService.updateIntegerAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch(':collectionId/attributes/float/:attributeId')
  @ResModel(Models.ATTRIBUTE_FLOAT)
  async updateFloatAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateFloatAttributeDTO,
  ) {
    return this.collectionsService.updateFloatAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch(':collectionId/attributes/boolean/:attributeId')
  @ResModel(Models.ATTRIBUTE_BOOLEAN)
  async updateBooleanAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateBooleanAttributeDTO,
  ) {
    return this.collectionsService.updateBooleanAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch(':collectionId/attributes/datetime/:attributeId')
  @ResModel(Models.ATTRIBUTE_DATETIME)
  async updateDatetimeAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateDatetimeAttributeDTO,
  ) {
    return this.collectionsService.updateDateAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch(':collectionId/attributes/relationship/:attributeId')
  @ResModel(Models.ATTRIBUTE_RELATIONSHIP)
  async updateRelationAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateRelationAttributeDTO,
  ) {
    return this.collectionsService.updateRelationshipAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Delete(':collectionId/attributes/:attributeId')
  @ResModel(Models.NONE)
  async removeAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.deleteAttribute(
      db,
      collectionId,
      attributeId,
      project,
    );
  }

  @Post(':collectionId/indexes')
  @ResModel(Models.INDEX)
  async createIndex(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() input: CreateIndexDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.createIndex(
      db,
      collectionId,
      input,
      project,
    );
  }

  @Get(':collectionId/indexes')
  @ResModel({ type: Models.INDEX, list: true })
  async findIndexes(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return this.collectionsService.getIndexes(db, collectionId, queries);
  }

  @Get(':collectionId/indexes/:indexId')
  @ResModel(Models.INDEX)
  async findIndex(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('indexId') indexId: string,
  ) {
    return this.collectionsService.getIndex(db, collectionId, indexId);
  }

  @Delete(':collectionId/indexes/:indexId')
  @ResModel(Models.NONE)
  async removeIndex(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('indexId') indexId: string,
    @Project() project: ProjectsDoc,
  ) {
    return this.collectionsService.deleteIndex(
      db,
      collectionId,
      indexId,
      project,
    );
  }

  @Post(':collectionId/documents')
  @ResModel(Models.DOCUMENT)
  async createDocument(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() document: CreateDocumentDTO,
    @Mode() mode: string,
  ) {
    return this.collectionsService.createDocument(
      db,
      collectionId,
      document,
      mode,
    );
  }

  @Get(':collectionId/documents/:documentId')
  @ResModel(Models.DOCUMENT)
  async findDocument(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return this.collectionsService.getDocument(
      db,
      collectionId,
      documentId,
      queries,
    );
  }

  @Get(':collectionId/documents/:documentId/logs')
  @ResModel({ type: Models.LOG, list: true })
  async findDocumentLogs(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return this.collectionsService.getDocumentLogs(
      db,
      collectionId,
      documentId,
      queries,
    );
  }

  @Patch(':collectionId/documents/:documentId')
  @ResModel(Models.DOCUMENT)
  async updateDocument(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Body() document: UpdateDocumentDTO,
    @Mode() mode: string,
  ) {
    return this.collectionsService.updateDocument(
      db,
      collectionId,
      documentId,
      document,
      mode,
    );
  }

  @Delete(':collectionId/documents/:documentId')
  @ResModel(Models.NONE)
  async removeDocument(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Mode() mode: string,
  ) {
    return this.collectionsService.deleteDocument(
      db,
      collectionId,
      documentId,
      mode,
    );
  }
}
