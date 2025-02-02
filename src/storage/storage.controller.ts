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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { StorageService } from './storage.service';
import { Response } from 'src/core/helper/response.helper';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import { User } from 'src/core/resolver/user.resolver';
import { Document, Query as Queries } from '@nuvix/database';
import { Mode } from 'src/core/resolver/model.resolver';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectGuard } from 'src/core/resolver/guards/project.guard';

import { UpdateFileDTO } from './DTO/file.dto';
import { CreateBucketDTO, UpdateBucketDTO } from './DTO/bucket.dto';

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
  @UseInterceptors(FileInterceptor('file'))
  async createFile(
    @Param('id') id: string,
    @Body('fileId') fileId: string,
    @Body('permissions') permissions: string[] = [],
    @UploadedFile() file: Express.Multer.File,
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

  @Get('buckets/:id/files/:fileId/preview')
  async previewFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
  ) {
    return await this.storageService.previewFile(id, fileId);
  }

  @Get('buckets/:id/files/:fileId/download')
  async downloadFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: any,
  ) {
    return await this.storageService.downloadFile(id, fileId, res, req);
  }

  @Get('buckets/:id/files/:fileId/view')
  async viewFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: any,
  ) {
    return await this.storageService.viewFile(id, fileId, res, req);
  }

  @Get('buckets/:id/files/:fileId/push')
  async getFileForPushNotification(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Query('jwt') jwt: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: any,
  ) {
    return await this.storageService.getFileForPushNotification(
      id,
      fileId,
      jwt,
      req,
      res,
    );
  }

  @Put('buckets/:id/files/:fileId')
  @ResponseType(Response.MODEL_FILE)
  async updateFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Body() updateFileDto: UpdateFileDTO,
  ) {
    return await this.storageService.updateFile(id, fileId, updateFileDto);
  }

  @Delete('buckets/:id/files/:fileId')
  @ResponseType(Response.MODEL_NONE)
  async deleteFile(@Param('id') id: string, @Param('fileId') fileId: string) {
    return await this.storageService.deleteFile(id, fileId);
  }

  @Get('usage')
  @ResponseType(Response.MODEL_USAGE_STORAGE)
  async getUsage(@Query('range') range?: string) {
    return await this.storageService.getStorageUsage(range);
  }

  @Get(':id/usage')
  @ResponseType(Response.MODEL_USAGE_BUCKETS)
  async getBucketUsage(
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    return await this.storageService.getBucketStorageUsage(id, range);
  }
}
