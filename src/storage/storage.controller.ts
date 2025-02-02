import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { StorageService } from './storage.service';
import { ProjectGuard } from 'src/core/resolver/guards/project.guard';
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { Response } from 'src/core/helper/response.helper';
import { Document, Query as Queries } from '@nuvix/database';
import { CreateBucketDTO, UpdateBucketDTO } from './DTO/bucket.dto';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import { CreateFileDTO } from './DTO/file.dto';
import { Request } from 'express';
import { User } from 'src/core/resolver/user.resolver';
import { Mode } from 'src/core/resolver/model.resolver';

@Controller({ version: ['1'], path: 'storage' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResolverInterceptor)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('buckets')
  @ResponseType({ type: Response.MODEL_BUCKET, list: true })
  async getBuckets(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.storageService.getBuckets(queries, search);
  }

  @Post('buckets')
  @ResponseType(Response.MODEL_BUCKET)
  async createBucket(@Body() createBucketDto: CreateBucketDTO) {
    return await this.storageService.createBucket(createBucketDto);
  }

  @Get('buckets/:id')
  @ResponseType(Response.MODEL_BUCKET)
  async getBucket(@Param('id') id: string) {
    return await this.storageService.getBucket(id);
  }

  @Put('buckets/:id')
  @ResponseType(Response.MODEL_BUCKET)
  async updateBucket(
    @Param('id') id: string,
    @Body() createBucketDto: UpdateBucketDTO,
  ) {
    return await this.storageService.updateBucket(id, createBucketDto);
  }

  @Delete('buckets/:id')
  @ResponseType(Response.MODEL_NONE)
  async deleteBucket(@Param('id') id: string) {
    return await this.storageService.deleteBucket(id);
  }

  @Get('buckets/:id/files')
  @ResponseType({ type: Response.MODEL_FILE, list: true })
  async getFiles(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.storageService.getFiles(id, queries, search);
  }

  @Post('buckets/:id/files')
  @ResponseType(Response.MODEL_FILE)
  // @UseInterceptors(FileInterceptor('file'))
  async createFile(
    @Param('id') id: string,
    @Body('fileId') fileId: string,
    @Body('permissions') permissions: string[],
    @UploadedFiles() file: Array<Express.Multer.File>,
    @Req() req: Request,
    @User('project') user: Document,
    @Mode() mode: string,
  ) {
    return await this.storageService.createFile(
      id,
      { fileId, permissions },
      file,
      req,
      user,
      mode,
    );
  }

  @Get('buckets/:id/files/:fileId')
  @ResponseType(Response.MODEL_FILE)
  async getFile(@Param('id') id: string, @Param('fileId') fileId: string) {
    return await this.storageService.getFile(id, fileId);
  }
}
