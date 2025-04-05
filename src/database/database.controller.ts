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
import { ResponseInterceptor } from 'src/core/resolvers/interceptors/response.interceptor';
import { DatabaseService } from './database.service';
import { ProjectGuard } from 'src/core/resolvers/guards/project.guard';
import { Models } from 'src/core/helper/response.helper';
import type { Database, Document, Query as Queries } from '@nuvix/database';
import { Mode } from 'src/core/decorators/mode.decorator';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import {
  CurrentDatabase,
  Project,
} from 'src/core/decorators/project.decorator';
import { ResModel } from 'src/core/decorators';

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
import { ApiInterceptor } from 'src/core/resolvers/interceptors/api.interceptor';

@Controller({ version: ['1'], path: 'databases' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  // @Post()
  // @ResModel(Models.DATABASE)
  // async create(@CurrentDatabase() db: Database,@Body() createDatabaseDto: CreateDatabaseDTO) {
  //   return await this.databaseService.create(db, createDatabaseDto);
  // }

  // @Get()
  // @ResModel({ type: Models.DATABASE, list: true })
  // async findAll(@CurrentDatabase() db: Database,
  //   @Query('queries', ParseQueryPipe) queries: Queries[],
  //   @Query('search') search?: string,
  // ) {
  //   return await this.databaseService.findAll(db, queries, search);
  // }

  // @Get('usage')
  // @ResModel(Models.USAGE_DATABASE)
  // async getUsage(@CurrentDatabase() db: Database,@Query('range') range?: string) {
  //   return await this.databaseService.getUsage(db, range);
  // }

  // @Get(':id')
  // @ResModel(Models.DATABASE)
  // async findOne(@CurrentDatabase() db: Database,@Param('id') id: string) {
  //   return await this.databaseService.findOne(db, id);
  // }

  // @Put(':id')
  // @ResModel(Models.DATABASE)
  // async update(@CurrentDatabase() db: Database,
  //   @Param('id') id: string,
  //   @Body() updateDatabaseDto: UpdateDatabaseDTO,
  // ) {
  //   return await this.databaseService.update(db,  updateDatabaseDto);
  // }

  // @Delete(':id')
  // @ResModel(Models.NONE)
  // async remove(@CurrentDatabase() db: Database,@Param('id') id: string, @Project() project: Document) {
  //   return await this.databaseService.remove(db,  project);
  // }

  // @Get(':id/usage')
  // @ResModel(Models.USAGE_DATABASE)
  // async getDatabaseUsage(@CurrentDatabase() db: Database,
  //   @Param('id') id: string,
  //   @Query('range') range?: string,
  // ) {
  //   return await this.databaseService.getDatabaseUsage(db,  range);
  // }

  // @Get(':id/logs')
  // @ResModel({ type: Models.LOG, list: true })
  // async findLogs(@CurrentDatabase() db: Database,
  //   @Param('id') id: string,
  //   @Query('queries', ParseQueryPipe) queries: Queries[],
  //   @Query('search') search?: string,
  // ) {
  //   return await this.databaseService.getLogs(db,  queries, search);
  // }

  @Get(':id/collections')
  @ResModel({ type: Models.COLLECTION, list: true })
  async findCollections(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.databaseService.getCollections(db, queries, search);
  }

  @Post(':id/collections')
  @ResModel(Models.COLLECTION)
  async createCollection(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Body() createCollectionDto: CreateCollectionDTO,
  ) {
    return await this.databaseService.createCollection(db, createCollectionDto);
  }

  @Get(':id/collections/:collectionId/usage')
  @ResModel(Models.USAGE_COLLECTION)
  async getCollectionUsage(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('range') range?: string,
  ) {
    return await this.databaseService.getCollectionUsage(
      db,

      collectionId,
      range,
    );
  }

  @Get(':id/collections/:collectionId')
  @ResModel(Models.COLLECTION)
  async findCollection(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
  ) {
    return await this.databaseService.getCollection(db, collectionId);
  }

  @Get(':id/collections/:collectionId/logs')
  @ResModel({ type: Models.LOG, list: true })
  async findCollectionLogs(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getCollectionLogs(
      db,

      collectionId,
      queries,
    );
  }

  @Put(':id/collections/:collectionId')
  @ResModel(Models.COLLECTION)
  async updateCollection(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() updateCollectionDto: UpdateCollectionDTO,
  ) {
    return await this.databaseService.updateCollection(
      db,

      collectionId,
      updateCollectionDto,
    );
  }

  @Delete(':id/collections/:collectionId')
  @ResModel(Models.NONE)
  async removeCollection(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Project() project: Document,
  ) {
    return await this.databaseService.removeCollection(
      db,

      collectionId,
      project,
    );
  }

  @Get(':id/collections/:collectionId/documents')
  @ResModel({ type: Models.DOCUMENT, list: true })
  async findDocuments(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getDocuments(db, collectionId, queries);
  }

  @Get(':id/collections/:collectionId/attributes')
  @ResModel({ type: Models.ATTRIBUTE, list: true })
  async findAttributes(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getAttributes(db, collectionId, queries);
  }

  @Post(':id/collections/:collectionId/attributes/string')
  @ResModel(Models.ATTRIBUTE_STRING)
  async createStringAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateStringAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createStringAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/email')
  @ResModel(Models.ATTRIBUTE_EMAIL)
  async createEmailAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateEmailAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createEmailAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/enum')
  @ResModel(Models.ATTRIBUTE_ENUM)
  async createEnumAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateEnumAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createEnumAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/ip')
  @ResModel(Models.ATTRIBUTE_IP)
  async createIpAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateIpAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createIPAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/url')
  @ResModel(Models.ATTRIBUTE_URL)
  async createUrlAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateURLAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createURLAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/integer')
  @ResModel(Models.ATTRIBUTE_INTEGER)
  async createIntegerAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateIntegerAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createIntegerAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/float')
  @ResModel(Models.ATTRIBUTE_FLOAT)
  async createFloatAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateFloatAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createFloatAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/boolean')
  @ResModel(Models.ATTRIBUTE_BOOLEAN)
  async createBooleanAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateBooleanAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createBooleanAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/datetime')
  @ResModel(Models.ATTRIBUTE_DATETIME)
  async createDatetimeAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateDatetimeAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createDateAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/relationship')
  @ResModel(Models.ATTRIBUTE_RELATIONSHIP)
  async createRelationAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateRelationAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createRelationshipAttribute(
      db,

      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Get(':id/collections/:collectionId/attributes/:attributeId')
  @ResModel(Models.ATTRIBUTE)
  async findAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
  ) {
    return await this.databaseService.getAttribute(
      db,

      collectionId,
      attributeId,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/string/:attributeId')
  @ResModel(Models.ATTRIBUTE_STRING)
  async updateStringAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateStringAttributeDTO,
  ) {
    return await this.databaseService.updateStringAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/email/:attributeId')
  @ResModel(Models.ATTRIBUTE_EMAIL)
  async updateEmailAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateEmailAttributeDTO,
  ) {
    return await this.databaseService.updateEmailAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/enum/:attributeId')
  @ResModel(Models.ATTRIBUTE_ENUM)
  async updateEnumAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateEnumAttributeDTO,
  ) {
    return await this.databaseService.updateEnumAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/ip/:attributeId')
  @ResModel(Models.ATTRIBUTE_IP)
  async updateIpAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateIpAttributeDTO,
  ) {
    return await this.databaseService.updateIPAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/url/:attributeId')
  @ResModel(Models.ATTRIBUTE_URL)
  async updateUrlAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateURLAttributeDTO,
  ) {
    return await this.databaseService.updateURLAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/integer/:attributeId')
  @ResModel(Models.ATTRIBUTE_INTEGER)
  async updateIntegerAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateIntegerAttributeDTO,
  ) {
    return await this.databaseService.updateIntegerAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/float/:attributeId')
  @ResModel(Models.ATTRIBUTE_FLOAT)
  async updateFloatAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateFloatAttributeDTO,
  ) {
    return await this.databaseService.updateFloatAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/boolean/:attributeId')
  @ResModel(Models.ATTRIBUTE_BOOLEAN)
  async updateBooleanAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateBooleanAttributeDTO,
  ) {
    return await this.databaseService.updateBooleanAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/datetime/:attributeId')
  @ResModel(Models.ATTRIBUTE_DATETIME)
  async updateDatetimeAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateDatetimeAttributeDTO,
  ) {
    return await this.databaseService.updateDateAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/relationship/:attributeId')
  @ResModel(Models.ATTRIBUTE_RELATIONSHIP)
  async updateRelationAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateRelationAttributeDTO,
  ) {
    return await this.databaseService.updateRelationshipAttribute(
      db,

      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Delete(':id/collections/:collectionId/attributes/:attributeId')
  @ResModel(Models.NONE)
  async removeAttribute(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Project() project: Document,
  ) {
    return await this.databaseService.deleteAttribute(
      db,

      collectionId,
      attributeId,
      project,
    );
  }

  @Post(':id/collections/:collectionId/indexes')
  @ResModel(Models.INDEX)
  async createIndex(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() input: CreateIndexDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createIndex(
      db,

      collectionId,
      input,
      project,
    );
  }

  @Get(':id/collections/:collectionId/indexes')
  @ResModel({ type: Models.INDEX, list: true })
  async findIndexes(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getIndexes(db, collectionId, queries);
  }

  @Get(':id/collections/:collectionId/indexes/:indexId')
  @ResModel(Models.INDEX)
  async findIndex(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('indexId') indexId: string,
  ) {
    return await this.databaseService.getIndex(db, collectionId, indexId);
  }

  @Delete(':id/collections/:collectionId/indexes/:indexId')
  @ResModel(Models.NONE)
  async removeIndex(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('indexId') indexId: string,
    @Project() project: Document,
  ) {
    return await this.databaseService.deleteIndex(
      db,

      collectionId,
      indexId,
      project,
    );
  }

  @Post(':id/collections/:collectionId/documents')
  @ResModel(Models.DOCUMENT)
  async createDocument(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() document: CreateDocumentDTO,
    @Mode() mode: string,
  ) {
    return await this.databaseService.createDocument(
      db,

      collectionId,
      document,
      mode,
    );
  }

  @Get(':id/collections/:collectionId/documents/:documentId')
  @ResModel(Models.DOCUMENT)
  async findDocument(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getDocument(
      db,

      collectionId,
      documentId,
      queries,
    );
  }

  @Get(':id/collections/:collectionId/documents/:documentId/logs')
  @ResModel({ type: Models.LOG, list: true })
  async findDocumentLogs(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getDocumentLogs(
      db,

      collectionId,
      documentId,
      queries,
    );
  }

  @Patch(':id/collections/:collectionId/documents/:documentId')
  @ResModel(Models.DOCUMENT)
  async updateDocument(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Body() document: UpdateDocumentDTO,
    @Mode() mode: string,
  ) {
    return await this.databaseService.updateDocument(
      db,

      collectionId,
      documentId,
      document,
      mode,
    );
  }

  @Delete(':id/collections/:collectionId/documents/:documentId')
  @ResModel(Models.NONE)
  async removeDocument(
    @CurrentDatabase() db: Database,
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Mode() mode: string,
  ) {
    return await this.databaseService.deleteDocument(
      db,

      collectionId,
      documentId,
      mode,
      null,
    );
  }
}
