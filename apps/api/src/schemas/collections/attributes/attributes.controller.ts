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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { AttributesService } from './attributes.service';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import { Models } from '@nuvix/core/helper/response.helper';
import type { Database, Query as Queries } from '@nuvix-tech/db';
import {
  CurrentDatabase,
  Project,
} from '@nuvix/core/decorators/project.decorator';
import { Auth, AuthType, Namespace, ResModel } from '@nuvix/core/decorators';

// DTOs
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
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import { DocSchemaGuard } from '@nuvix/core/resolvers/guards';
import type { ProjectsDoc } from '@nuvix/utils/types';
import { AttributesQueryPipe } from '@nuvix/core/pipes/queries';

@Controller({
  version: ['1'],
  path: 'schemas/:schemaId/collections/:collectionId/attributes',
})
@Namespace('schemas')
@UseGuards(ProjectGuard, DocSchemaGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.KEY])
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  @ResModel(Models.ATTRIBUTE, { list: true })
  async findAttributes(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Query('queries', AttributesQueryPipe) queries?: Queries[],
  ) {
    return this.attributesService.getAttributes(db, collectionId, queries);
  }

  @Post('string')
  @ResModel(Models.ATTRIBUTE_STRING)
  async createStringAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateStringAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createStringAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post('email')
  @ResModel(Models.ATTRIBUTE_EMAIL)
  async createEmailAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateEmailAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createEmailAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post('enum')
  @ResModel(Models.ATTRIBUTE_ENUM)
  async createEnumAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateEnumAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createEnumAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post('ip')
  @ResModel(Models.ATTRIBUTE_IP)
  async createIpAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateIpAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createIPAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post('url')
  @ResModel(Models.ATTRIBUTE_URL)
  async createUrlAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateURLAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createURLAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post('integer')
  @ResModel(Models.ATTRIBUTE_INTEGER)
  async createIntegerAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateIntegerAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createIntegerAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post('float')
  @ResModel(Models.ATTRIBUTE_FLOAT)
  async createFloatAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateFloatAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createFloatAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post('boolean')
  @ResModel(Models.ATTRIBUTE_BOOLEAN)
  async createBooleanAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateBooleanAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createBooleanAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post('datetime')
  @ResModel(Models.ATTRIBUTE_DATETIME)
  async createDatetimeAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateDatetimeAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createDateAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Post('relationship')
  @ResModel(Models.ATTRIBUTE_RELATIONSHIP)
  async createRelationAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Body() createAttributeDTO: CreateRelationAttributeDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.createRelationshipAttribute(
      db,
      collectionId,
      createAttributeDTO,
      project,
    );
  }

  @Get(':attributeId')
  @ResModel(Models.ATTRIBUTE)
  async findAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
  ) {
    return this.attributesService.getAttribute(db, collectionId, attributeId);
  }

  @Patch('string/:attributeId')
  @ResModel(Models.ATTRIBUTE_STRING)
  async updateStringAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateStringAttributeDTO,
  ) {
    return this.attributesService.updateStringAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch('email/:attributeId')
  @ResModel(Models.ATTRIBUTE_EMAIL)
  async updateEmailAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateEmailAttributeDTO,
  ) {
    return this.attributesService.updateEmailAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch('enum/:attributeId')
  @ResModel(Models.ATTRIBUTE_ENUM)
  async updateEnumAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateEnumAttributeDTO,
  ) {
    return this.attributesService.updateEnumAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch('ip/:attributeId')
  @ResModel(Models.ATTRIBUTE_IP)
  async updateIpAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateIpAttributeDTO,
  ) {
    return this.attributesService.updateIPAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch('url/:attributeId')
  @ResModel(Models.ATTRIBUTE_URL)
  async updateUrlAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateURLAttributeDTO,
  ) {
    return this.attributesService.updateURLAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch('integer/:attributeId')
  @ResModel(Models.ATTRIBUTE_INTEGER)
  async updateIntegerAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateIntegerAttributeDTO,
  ) {
    return this.attributesService.updateIntegerAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch('float/:attributeId')
  @ResModel(Models.ATTRIBUTE_FLOAT)
  async updateFloatAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateFloatAttributeDTO,
  ) {
    return this.attributesService.updateFloatAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch('boolean/:attributeId')
  @ResModel(Models.ATTRIBUTE_BOOLEAN)
  async updateBooleanAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateBooleanAttributeDTO,
  ) {
    return this.attributesService.updateBooleanAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch('datetime/:attributeId')
  @ResModel(Models.ATTRIBUTE_DATETIME)
  async updateDatetimeAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateDatetimeAttributeDTO,
  ) {
    return this.attributesService.updateDateAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Patch('relationship/:attributeId')
  @ResModel(Models.ATTRIBUTE_RELATIONSHIP)
  async updateRelationAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Body() updateAttributeDTO: UpdateRelationAttributeDTO,
  ) {
    return this.attributesService.updateRelationshipAttribute(
      db,
      collectionId,
      attributeId,
      updateAttributeDTO,
    );
  }

  @Delete(':attributeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResModel(Models.NONE)
  async removeAttribute(
    @CurrentDatabase() db: Database,
    @Param('collectionId') collectionId: string,
    @Param('attributeId') attributeId: string,
    @Project() project: ProjectsDoc,
  ) {
    return this.attributesService.deleteAttribute(
      db,
      collectionId,
      attributeId,
      project,
    );
  }
}
