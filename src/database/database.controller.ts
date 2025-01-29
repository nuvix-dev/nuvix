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
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { DatabaseService } from './database.service';
import { ProjectGuard } from 'src/core/resolver/guards/project.guard';
import { Response } from 'src/core/helper/response.helper';
import type { Document, Query as Queries } from '@nuvix/database';
import { Mode } from 'src/core/resolver/model.resolver';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import { Project } from 'src/core/resolver/project.resolver';

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

@Controller({ version: ['1'], path: 'databases' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResolverInterceptor)
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Post()
  @ResponseType(Response.MODEL_DATABASE)
  async create(@Body() createDatabaseDto: CreateDatabaseDTO) {
    return await this.databaseService.create(createDatabaseDto);
  }

  @Get()
  @ResponseType({ type: Response.MODEL_DATABASE, list: true })
  async findAll(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.databaseService.findAll(queries, search);
  }

  @Get('usage')
  @ResponseType(Response.MODEL_USAGE_DATABASE)
  async getUsage(@Query('range') range?: string) {
    return await this.databaseService.getUsage(range);
  }

  @Get(':id')
  @ResponseType(Response.MODEL_DATABASE)
  async findOne(@Param('id') id: string) {
    return await this.databaseService.findOne(id);
  }

  @Put(':id')
  @ResponseType(Response.MODEL_DATABASE)
  async update(
    @Param('id') id: string,
    @Body() updateDatabaseDto: UpdateDatabaseDTO,
  ) {
    return await this.databaseService.update(id, updateDatabaseDto);
  }

  @Delete(':id')
  @ResponseType(Response.MODEL_NONE)
  async remove(@Param('id') id: string) {
    return await this.databaseService.remove(id);
  }

  @Get(':id/usage')
  @ResponseType(Response.MODEL_USAGE_DATABASE)
  async getDatabaseUsage(
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    return await this.databaseService.getDatabaseUsage(id, range);
  }

  @Get(':id/logs')
  @ResponseType({ type: Response.MODEL_LOG, list: true })
  async findLogs(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.databaseService.getLogs(id, queries, search);
  }

  @Get(':id/collections')
  @ResponseType({ type: Response.MODEL_COLLECTION, list: true })
  async findCollections(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.databaseService.getCollections(id, queries, search);
  }

  @Post(':id/collections')
  @ResponseType(Response.MODEL_COLLECTION)
  async createCollection(
    @Param('id') id: string,
    @Body() createCollectionDto: CreateCollectionDTO,
  ) {
    return await this.databaseService.createCollection(id, createCollectionDto);
  }

  @Get(':id/collections/:collectionId/usage')
  @ResponseType(Response.MODEL_USAGE_COLLECTION)
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
  @ResponseType(Response.MODEL_COLLECTION)
  async findCollection(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
  ) {
    return await this.databaseService.getCollection(id, collectionId);
  }

  @Get(':id/collections/:collectionId/logs')
  @ResponseType({ type: Response.MODEL_LOG, list: true })
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
  @ResponseType(Response.MODEL_COLLECTION)
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
  @ResponseType(Response.MODEL_NONE)
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
  @ResponseType({ type: Response.MODEL_DOCUMENT, list: true })
  async findDocuments(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getDocuments(id, collectionId, queries);
  }

  @Get(':id/collections/:collectionId/attributes')
  @ResponseType({ type: Response.MODEL_ATTRIBUTE, list: true })
  async findAttributes(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getAttributes(id, collectionId, queries);
  }

  @Post(':id/collections/:collectionId/attributes/string')
  @ResponseType(Response.MODEL_ATTRIBUTE_STRING)
  async createStringAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateStringAttributeDTO,
  ) {
    return await this.databaseService.createStringAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Post(':id/collections/:collectionId/attributes/email')
  @ResponseType(Response.MODEL_ATTRIBUTE_EMAIL)
  async createEmailAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateEmailAttributeDTO,
  ) {
    return await this.databaseService.createEmailAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Post(':id/collections/:collectionId/attributes/enum')
  @ResponseType(Response.MODEL_ATTRIBUTE_ENUM)
  async createEnumAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateEnumAttributeDTO,
  ) {
    return await this.databaseService.createEnumAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Post(':id/collections/:collectionId/attributes/ip')
  @ResponseType(Response.MODEL_ATTRIBUTE_IP)
  async createIpAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateIpAttributeDTO,
  ) {
    return await this.databaseService.createIPAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Post(':id/collections/:collectionId/attributes/url')
  @ResponseType(Response.MODEL_ATTRIBUTE_URL)
  async createUrlAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateURLAttributeDTO,
  ) {
    return await this.databaseService.createURLAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Post(':id/collections/:collectionId/attributes/integer')
  @ResponseType(Response.MODEL_ATTRIBUTE_INTEGER)
  async createIntegerAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateIntegerAttributeDTO,
  ) {
    return await this.databaseService.createIntegerAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Post(':id/collections/:collectionId/attributes/float')
  @ResponseType(Response.MODEL_ATTRIBUTE_FLOAT)
  async createFloatAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateFloatAttributeDTO,
  ) {
    return await this.databaseService.createFloatAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Post(':id/collections/:collectionId/attributes/boolean')
  @ResponseType(Response.MODEL_ATTRIBUTE_BOOLEAN)
  async createBooleanAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateBooleanAttributeDTO,
  ) {
    return await this.databaseService.createBooleanAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Post(':id/collections/:collectionId/attributes/datetime')
  @ResponseType(Response.MODEL_ATTRIBUTE_DATETIME)
  async createDatetimeAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateDatetimeAttributeDTO,
  ) {
    return await this.databaseService.createDateAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Post(':id/collections/:collectionId/attributes/relationship')
  @ResponseType(Response.MODEL_ATTRIBUTE_RELATIONSHIP)
  async createRelationAttribute(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDto: CreateRelationAttributeDTO,
  ) {
    return await this.databaseService.createRelationshipAttribute(
      id,
      collectionId,
      createAttributeDto,
    );
  }

  @Get(':id/collections/:collectionId/attributes/:attributeId')
  @ResponseType(Response.MODEL_ATTRIBUTE)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_STRING)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_EMAIL)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_ENUM)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_IP)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_URL)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_INTEGER)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_FLOAT)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_BOOLEAN)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_DATETIME)
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
  @ResponseType(Response.MODEL_ATTRIBUTE_RELATIONSHIP)
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
  @ResponseType(Response.MODEL_NONE)
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
  @ResponseType(Response.MODEL_INDEX)
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
  @ResponseType({ type: Response.MODEL_INDEX, list: true })
  async findIndexes(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
  ) {
    return await this.databaseService.getIndexes(id, collectionId, queries);
  }

  @Get(':id/collections/:collectionId/indexes/:indexId')
  @ResponseType(Response.MODEL_INDEX)
  async findIndex(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('indexId') indexId: string,
  ) {
    return await this.databaseService.getIndex(id, collectionId, indexId);
  }

  @Delete(':id/collections/:collectionId/indexes/:indexId')
  @ResponseType(Response.MODEL_NONE)
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
  @ResponseType(Response.MODEL_DOCUMENT)
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
  @ResponseType(Response.MODEL_DOCUMENT)
  async findDocument(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Param('documentId') documentId: string,
    @Query('queries') queries: Queries[],
  ) {
    return await this.databaseService.getDocument(
      id,
      collectionId,
      documentId,
      queries,
    );
  }

  @Get(':id/collections/:collectionId/documents/:documentId/logs')
  @ResponseType({ type: Response.MODEL_LOG, list: true })
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
  @ResponseType(Response.MODEL_DOCUMENT)
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
  @ResponseType(Response.MODEL_NONE)
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
