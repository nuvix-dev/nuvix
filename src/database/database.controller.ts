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
  Req,
} from '@nestjs/common';
import { ResponseInterceptor } from 'src/core/resolvers/interceptors/response.interceptor';
import { DatabaseService } from './database.service';
import { ProjectGuard } from 'src/core/resolvers/guards/project.guard';
import { Models } from 'src/core/helper/response.helper';
import type { Document, Query as Queries } from '@nuvix/database';
import { Mode } from 'src/core/decorators/mode.decorator';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import { Project } from 'src/core/decorators/project.decorator';
import { ResModel } from 'src/core/decorators';

// DTOs
import { CreateDatabaseDTO, UpdateDatabaseDTO } from './DTO/database.dto';
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

  @Post()
  @ResModel(Models.DATABASE)
  async create(@Body() createDatabaseDto: CreateDatabaseDTO) {
    return await this.databaseService.create(createDatabaseDto);
  }

  @Get()
  @ResModel({ type: Models.DATABASE, list: true })
  async findAll(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.databaseService.findAll(queries, search);
  }

  @Get('usage')
  @ResModel(Models.USAGE_DATABASE)
  async getUsage(@Query('range') range?: string) {
    return await this.databaseService.getUsage(range);
  }

  @Get(':id')
  @ResModel(Models.DATABASE)
  async findOne(@Param('id') id: string) {
    return await this.databaseService.findOne(id);
  }

  @Put(':id')
  @ResModel(Models.DATABASE)
  async update(
    @Param('id') id: string,
    @Body() updateDatabaseDto: UpdateDatabaseDTO,
  ) {
    return await this.databaseService.update(id, updateDatabaseDto);
  }

  @Delete(':id')
  @ResModel(Models.NONE)
  async remove(@Param('id') id: string, @Project() project: Document) {
    return await this.databaseService.remove(id, project);
  }

  @Get(':id/usage')
  @ResModel(Models.USAGE_DATABASE)
  async getDatabaseUsage(
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    return await this.databaseService.getDatabaseUsage(id, range);
  }

  @Get(':id/logs')
  @ResModel({ type: Models.LOG, list: true })
  async findLogs(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.databaseService.getLogs(id, queries, search);
  }

  @Get(':id/collections')
  @ResModel({ type: Models.COLLECTION, list: true })
  async findCollections(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.databaseService.getCollections(id, queries, search);
  }

  @Post(':id/collections')
  @ResModel(Models.COLLECTION)
  async createCollection(
    @Param('id') id: string,
    @Body() createCollectionDto: CreateCollectionDTO,
  ) {
    return await this.databaseService.createCollection(id, createCollectionDto);
  }

  @Get(':id/collections/:collectionId/usage')
  @ResModel(Models.USAGE_COLLECTION)
  async getCollectionUsage(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('range') range?: string,
  ) {
    return await this.databaseService.getCollectionUsage(
      id,
      collectionId,
      range,
    );
  }

  @Get(':id/collections/:collectionId')
  @ResModel(Models.COLLECTION)
  async findCollection(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
  ) {
    return await this.databaseService.getCollection(id, collectionId);
  }

  @Get(':id/collections/:collectionId/logs')
  @ResModel({ type: Models.LOG, list: true })
  async findCollectionLogs(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getCollectionLogs(
      id,
      collectionId,
      queries,
    );
  }

  @Put(':id/collections/:collectionId')
  @ResModel(Models.COLLECTION)
  async updateCollection(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() updateCollectionDto: UpdateCollectionDTO,
  ) {
    return await this.databaseService.updateCollection(
      id,
      collectionId,
      updateCollectionDto,
    );
  }

  @Delete(':id/collections/:collectionId')
  @ResModel(Models.NONE)
  async removeCollection(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Project() project: Document,
  ) {
    return await this.databaseService.removeCollection(
      id,
      collectionId,
      project,
    );
  }

  @Get(':id/collections/:collectionId/documents')
  @ResModel({ type: Models.DOCUMENT, list: true })
  async findDocuments(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getDocuments(id, collectionId, queries);
  }

  @Get(':id/collections/:collectionId/attributes')
  @ResModel({ type: Models.ATTRIBUTE, list: true })
  async findAttributes(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getAttributes(id, collectionId, queries);
  }

  @Post(':id/collections/:collectionId/attributes/string')
  @ResModel(Models.ATTRIBUTE_STRING)
  async createStringAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateStringAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createStringAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/email')
  @ResModel(Models.ATTRIBUTE_EMAIL)
  async createEmailAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateEmailAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createEmailAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/enum')
  @ResModel(Models.ATTRIBUTE_ENUM)
  async createEnumAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateEnumAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createEnumAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/ip')
  @ResModel(Models.ATTRIBUTE_IP)
  async createIpAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateIpAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createIPAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/url')
  @ResModel(Models.ATTRIBUTE_URL)
  async createUrlAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateURLAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createURLAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/integer')
  @ResModel(Models.ATTRIBUTE_INTEGER)
  async createIntegerAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateIntegerAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createIntegerAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/float')
  @ResModel(Models.ATTRIBUTE_FLOAT)
  async createFloatAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateFloatAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createFloatAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/boolean')
  @ResModel(Models.ATTRIBUTE_BOOLEAN)
  async createBooleanAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateBooleanAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createBooleanAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/datetime')
  @ResModel(Models.ATTRIBUTE_DATETIME)
  async createDatetimeAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateDatetimeAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createDateAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Post(':id/collections/:collectionId/attributes/relationship')
  @ResModel(Models.ATTRIBUTE_RELATIONSHIP)
  async createRelationAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateRelationAttributeDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createRelationshipAttribute(
      id,
      collectionId,
      createAttributeDto,
      project,
    );
  }

  @Get(':id/collections/:collectionId/attributes/:attributeId')
  @ResModel(Models.ATTRIBUTE)
  async findAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
  ) {
    return await this.databaseService.getAttribute(
      id,
      collectionId,
      attributeId,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/string/:attributeId')
  @ResModel(Models.ATTRIBUTE_STRING)
  async updateStringAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateStringAttributeDTO,
  ) {
    return await this.databaseService.updateStringAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/email/:attributeId')
  @ResModel(Models.ATTRIBUTE_EMAIL)
  async updateEmailAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateEmailAttributeDTO,
  ) {
    return await this.databaseService.updateEmailAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/enum/:attributeId')
  @ResModel(Models.ATTRIBUTE_ENUM)
  async updateEnumAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateEnumAttributeDTO,
  ) {
    return await this.databaseService.updateEnumAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/ip/:attributeId')
  @ResModel(Models.ATTRIBUTE_IP)
  async updateIpAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateIpAttributeDTO,
  ) {
    return await this.databaseService.updateIPAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/url/:attributeId')
  @ResModel(Models.ATTRIBUTE_URL)
  async updateUrlAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateURLAttributeDTO,
  ) {
    return await this.databaseService.updateURLAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/integer/:attributeId')
  @ResModel(Models.ATTRIBUTE_INTEGER)
  async updateIntegerAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateIntegerAttributeDTO,
  ) {
    return await this.databaseService.updateIntegerAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/float/:attributeId')
  @ResModel(Models.ATTRIBUTE_FLOAT)
  async updateFloatAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateFloatAttributeDTO,
  ) {
    return await this.databaseService.updateFloatAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/boolean/:attributeId')
  @ResModel(Models.ATTRIBUTE_BOOLEAN)
  async updateBooleanAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateBooleanAttributeDTO,
  ) {
    return await this.databaseService.updateBooleanAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/datetime/:attributeId')
  @ResModel(Models.ATTRIBUTE_DATETIME)
  async updateDatetimeAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateDatetimeAttributeDTO,
  ) {
    return await this.databaseService.updateDateAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Patch(':id/collections/:collectionId/attributes/relationship/:attributeId')
  @ResModel(Models.ATTRIBUTE_RELATIONSHIP)
  async updateRelationAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDto: UpdateRelationAttributeDTO,
  ) {
    return await this.databaseService.updateRelationshipAttribute(
      id,
      collectionId,
      attributeId,
      updateAttributeDto,
    );
  }

  @Delete(':id/collections/:collectionId/attributes/:attributeId')
  @ResModel(Models.NONE)
  async removeAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Project() project: Document,
  ) {
    return await this.databaseService.deleteAttribute(
      id,
      collectionId,
      attributeId,
      project,
    );
  }

  @Post(':id/collections/:collectionId/indexes')
  @ResModel(Models.INDEX)
  async createIndex(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() input: CreateIndexDTO,
    @Project() project: Document,
  ) {
    return await this.databaseService.createIndex(
      id,
      collectionId,
      input,
      project,
    );
  }

  @Get(':id/collections/:collectionId/indexes')
  @ResModel({ type: Models.INDEX, list: true })
  async findIndexes(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getIndexes(id, collectionId, queries);
  }

  @Get(':id/collections/:collectionId/indexes/:indexId')
  @ResModel(Models.INDEX)
  async findIndex(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('indexId') indexId: string,
  ) {
    return await this.databaseService.getIndex(id, collectionId, indexId);
  }

  @Delete(':id/collections/:collectionId/indexes/:indexId')
  @ResModel(Models.NONE)
  async removeIndex(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('indexId') indexId: string,
    @Project() project: Document,
  ) {
    return await this.databaseService.deleteIndex(
      id,
      collectionId,
      indexId,
      project,
    );
  }

  @Post(':id/collections/:collectionId/documents')
  @ResModel(Models.DOCUMENT)
  async createDocument(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() document: CreateDocumentDTO,
    @Mode() mode: string,
  ) {
    return await this.databaseService.createDocument(
      id,
      collectionId,
      document,
      mode,
    );
  }

  @Get(':id/collections/:collectionId/documents/:documentId')
  @ResModel(Models.DOCUMENT)
  async findDocument(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getDocument(
      id,
      collectionId,
      documentId,
      queries,
    );
  }

  @Get(':id/collections/:collectionId/documents/:documentId/logs')
  @ResModel({ type: Models.LOG, list: true })
  async findDocumentLogs(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getDocumentLogs(
      id,
      collectionId,
      documentId,
      queries,
    );
  }

  @Patch(':id/collections/:collectionId/documents/:documentId')
  @ResModel(Models.DOCUMENT)
  async updateDocument(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Body() document: UpdateDocumentDTO,
    @Mode() mode: string,
  ) {
    return await this.databaseService.updateDocument(
      id,
      collectionId,
      documentId,
      document,
      mode,
    );
  }

  @Delete(':id/collections/:collectionId/documents/:documentId')
  @ResModel(Models.NONE)
  async removeDocument(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Mode() mode: string,
  ) {
    return await this.databaseService.deleteDocument(
      id,
      collectionId,
      documentId,
      mode,
      null,
    );
  }
}
