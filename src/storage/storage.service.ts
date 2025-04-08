import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import {
  Authorization,
  Database,
  Document,
  DuplicateException,
  ID,
  Permission,
  Query,
} from '@nuvix/database';
import { Exception } from 'src/core/extend/exception';
import {
  APP_LIMIT_COUNT,
  APP_STORAGE_LIMIT,
  APP_STORAGE_UPLOADS,
} from 'src/Utils/constants';
import { CreateBucketDTO, UpdateBucketDTO } from './DTO/bucket.dto';
import collections from 'src/core/collections';
import { Auth } from 'src/core/helper/auth.helper';
import { CreateFileDTO, UpdateFileDTO } from './DTO/file.dto';
import { FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { JwtService } from '@nestjs/jwt';
import usageConfig from 'src/core/config/usage';
import sharp from 'sharp';
import { MultipartFile } from '@fastify/multipart';
import { CreateFolderDTO, UploadFileDTO } from './DTO/object.dto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Get buckets.
   */
  async getBuckets(db: Database, queries: any, search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const cursor = queries.find((query: Query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const bucketId = cursor.getValue();
      const cursorDocument = await db.getDocument('buckets', bucketId);

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Bucket '${bucketId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const filterQueries = Query.groupByType(queries).filters;

    return {
      buckets: await db.find('buckets', queries),
      total: await db.count('buckets', filterQueries, APP_LIMIT_COUNT),
    };
  }

  /**
   * Create bucket.
   */
  async createBucket(db: Database, input: CreateBucketDTO) {
    const bucketId =
      input.bucketId === 'unique()' ? ID.unique() : input.bucketId;

    // Map aggregate permissions into the multiple permissions they represent.
    const permissions = Permission.aggregate(input.permissions ?? []);

    try {
      const objects = (collections['buckets'] ?? {})['objects'] ?? {};
      if (!objects) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Files collection is not configured.',
        );
      }

      const attributes = objects['attributes'].map(
        (attribute: any) =>
          new Document({
            $id: attribute.$id,
            type: attribute.type,
            size: attribute.size,
            required: attribute.required,
            signed: attribute.signed,
            array: attribute.array,
            filters: attribute.filters,
            default: attribute.default ?? null,
            format: attribute.format ?? '',
          }),
      );

      const indexes = objects['indexes'].map(
        (index: any) =>
          new Document({
            $id: index.$id,
            type: index.type,
            attributes: index.attributes,
            lengths: index.lengths,
            orders: index.orders,
          }),
      );

      await db.createDocument(
        'buckets',
        new Document({
          $id: bucketId,
          $collection: 'buckets',
          $permissions: permissions,
          name: input.name,
          maximumFileSize: input.maximumFileSize,
          allowedFileExtensions: input.allowedFileExtensions,
          fileSecurity: input.fileSecurity,
          enabled: input.enabled,
          compression: input.compression,
          encryption: input.encryption,
          antivirus: input.antivirus,
          search: [bucketId, input.name].join(' '),
        }),
      );

      const bucket = await db.getDocument('buckets', bucketId);

      await db.createCollection({
        id: 'bucket_' + bucket.getInternalId(),
        attributes,
        indexes,
        permissions: permissions ?? [],
        documentSecurity: input.fileSecurity,
      });

      return bucket;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.STORAGE_BUCKET_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Get a bucket.
   */
  async getBucket(db: Database, id: string) {
    const bucket = await db.getDocument('buckets', id);

    if (bucket.isEmpty())
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);

    return bucket;
  }

  /**
   * Update a bucket.
   */
  async updateBucket(db: Database, id: string, input: UpdateBucketDTO) {
    const bucket = await db.getDocument('buckets', id);

    if (bucket.isEmpty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const permissions = Permission.aggregate(
      input.permissions ?? bucket.getPermissions(),
    );
    const maximumFileSize =
      input.maximumFileSize ??
      bucket.getAttribute('maximumFileSize', APP_LIMIT_COUNT);
    const allowedFileExtensions =
      input.allowedFileExtensions ??
      bucket.getAttribute('allowedFileExtensions', []);
    const enabled = input.enabled ?? bucket.getAttribute('enabled', true);
    const encryption =
      input.encryption ?? bucket.getAttribute('encryption', true);
    const antivirus = input.antivirus ?? bucket.getAttribute('antivirus', true);

    const updatedBucket = await db.updateDocument(
      'buckets',
      id,
      bucket
        .setAttribute('name', input.name)
        .setAttribute('$permissions', permissions)
        .setAttribute('maximumFileSize', maximumFileSize)
        .setAttribute('allowedFileExtensions', allowedFileExtensions)
        .setAttribute('fileSecurity', input.fileSecurity)
        .setAttribute('enabled', enabled)
        .setAttribute('encryption', encryption)
        .setAttribute('compression', input.compression)
        .setAttribute('antivirus', antivirus),
    );

    await db.updateCollection(
      'bucket_' + bucket.getInternalId(),
      permissions,
      input.fileSecurity,
    );

    return updatedBucket;
  }

  /**
   * Delete a bucket.
   */
  async deleteBucket(db: Database, id: string) {
    const bucket = await db.getDocument('buckets', id);

    if (bucket.isEmpty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    if (!(await db.deleteDocument('buckets', id))) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove bucket from DB',
      );
    }

    await db.deleteCollection('bucket_' + bucket.getInternalId()); // TODO: use queues to delete
    return {};
  }

  /**
   * Get files.
   * @deprecated use `getObjects` instead
   */
  async getFiles(
    db: Database,
    bucketId: string,
    queries: Query[],
    search?: string,
  ) {
    const bucket = await db.getDocument('buckets', bucketId);

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.getAttribute('fileSecurity', false);
    const validator = new Authorization(Database.PERMISSION_READ);
    const valid = validator.isValid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    if (search) {
      queries.push(Query.search('search', search));
    }

    const cursor = queries.find((query: Query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const fileId = cursor.getValue();

      const cursorDocument =
        fileSecurity && !valid
          ? await db.getDocument('bucket_' + bucket.getInternalId(), fileId)
          : await Authorization.skip(() =>
              db.getDocument('bucket_' + bucket.getInternalId(), fileId),
            );

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `File '${fileId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const filterQueries = Query.groupByType(queries).filters;

    const files =
      fileSecurity && !valid
        ? await db.find('bucket_' + bucket.getInternalId(), queries)
        : await Authorization.skip(() =>
            db.find('bucket_' + bucket.getInternalId(), queries),
          );

    const total =
      fileSecurity && !valid
        ? await db.count(
            'bucket_' + bucket.getInternalId(),
            filterQueries,
            APP_LIMIT_COUNT,
          )
        : await Authorization.skip(() =>
            db.count(
              'bucket_' + bucket.getInternalId(),
              filterQueries,
              APP_LIMIT_COUNT,
            ),
          );

    return {
      files,
      total,
    };
  }

  /**
   * Get Objects
   */
  async getObjects(
    db: Database,
    bucketId: string,
    queries: Query[],
    search?: string,
    path?: string,
  ) {
    const bucket = await db.getDocument('buckets', bucketId);

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.getAttribute('fileSecurity', false);
    const validator = new Authorization(Database.PERMISSION_READ);
    const valid = validator.isValid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    if (search) {
      queries.push(Query.search('search', search));
    }

    if (path) {
      queries.push(Query.startsWith('name', path));
    }

    const cursor = queries.find((query: Query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const objectId = cursor.getValue();

      const cursorDocument =
        fileSecurity && !valid
          ? await db.getDocument('bucket_' + bucket.getInternalId(), objectId)
          : await Authorization.skip(() =>
              db.getDocument('bucket_' + bucket.getInternalId(), objectId),
            );

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Object '${objectId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const filterQueries = Query.groupByType(queries).filters;

    const objects =
      fileSecurity && !valid
        ? await db.find('bucket_' + bucket.getInternalId(), queries)
        : await Authorization.skip(() =>
            db.find('bucket_' + bucket.getInternalId(), queries),
          );

    const total =
      fileSecurity && !valid
        ? await db.count(
            'bucket_' + bucket.getInternalId(),
            filterQueries,
            APP_LIMIT_COUNT,
          )
        : await Authorization.skip(() =>
            db.count(
              'bucket_' + bucket.getInternalId(),
              filterQueries,
              APP_LIMIT_COUNT,
            ),
          );

    return {
      objects,
      total,
    };
  }

  /**
   * Create folder.
   */
  async createFolder(
    db: Database,
    user: Document,
    bucketId: string,
    data: CreateFolderDTO,
  ) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const validator = new Authorization(Database.PERMISSION_CREATE);
    if (!validator.isValid(bucket.getCreate())) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const allowedPermissions = [
      Database.PERMISSION_READ,
      Database.PERMISSION_UPDATE,
      Database.PERMISSION_DELETE,
    ];

    let permissions = Permission.aggregate(
      data.permissions,
      allowedPermissions,
    );
    if (!permissions || permissions.length === 0) {
      permissions = user.getId()
        ? allowedPermissions.map(permission =>
            new Permission(permission, 'user', user.getId()).toString(),
          )
        : [];
    }

    const roles = Authorization.getRoles();
    if (!Auth.isAppUser(roles) && !Auth.isPrivilegedUser(roles)) {
      permissions.forEach(permission => {
        const parsedPermission = Permission.parse(permission);
        if (!Authorization.isRole(parsedPermission.toString())) {
          throw new Exception(
            Exception.USER_UNAUTHORIZED,
            `Permissions must be one of: (${roles.join(', ')})`,
          );
        }
      });
    }

    const folderId = ID.unique();
    const tokens = data.name
      .split('/')
      .filter(Boolean)
      .map((token: string) => {
        return token.replace(/[^a-zA-Z0-9-_]/g, '');
      });
    tokens.push('.empty');

    const folder = await db.createDocument(
      `bucket_${bucket.getInternalId()}`,
      new Document({
        $id: folderId,
        name: `${data.name}/.empty`,
        $permissions: permissions,
        metadata: {
          content_type: 'application/x-directory',
          size: 0,
          sizeActual: 0,
          signature: '',
          mimeType: 'application/x-directory',
          chunksTotal: 0,
          chunksUploaded: 0,
        },
        tokens,
        version: crypto.randomUUID(),
        user_metadata: data.metadata,
      }),
    );
    return folder;
  }

  /**
   * Create|Upload file.
   * @deprecated use `createObject` instead
   */
  async createFile(
    db: Database,
    bucketId: string,
    input: CreateFileDTO,
    file: MultipartFile,
    request: FastifyRequest,
    user: Document,
    mode: string,
  ) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const validator = new Authorization(Database.PERMISSION_CREATE);
    if (!validator.isValid(bucket.getCreate())) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const allowedPermissions = [
      Database.PERMISSION_READ,
      Database.PERMISSION_UPDATE,
      Database.PERMISSION_DELETE,
    ];

    let permissions = Permission.aggregate(
      input.permissions,
      allowedPermissions,
    );
    if (!permissions || permissions.length === 0) {
      permissions = user.getId()
        ? allowedPermissions.map(permission =>
            new Permission(permission, 'user', user.getId()).toString(),
          )
        : [];
    }

    const roles = Authorization.getRoles();
    if (!Auth.isAppUser(roles) && !Auth.isPrivilegedUser(roles)) {
      permissions.forEach(permission => {
        const parsedPermission = Permission.parse(permission);
        if (!Authorization.isRole(parsedPermission.toString())) {
          throw new Exception(
            Exception.USER_UNAUTHORIZED,
            `Permissions must be one of: (${roles.join(', ')})`,
          );
        }
      });
    }

    const maximumFileSize = bucket.getAttribute('maximumFileSize', 0);
    if (maximumFileSize > APP_STORAGE_LIMIT) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Maximum bucket file size is larger than _APP_STORAGE_LIMIT',
      );
    }

    if (Array.isArray(file)) file = file[0];
    if (!file) {
      throw new Exception(Exception.STORAGE_FILE_EMPTY);
    }

    const fileName = file.filename;
    const fileBuffer = await file.toBuffer();
    const fileSize = fileBuffer.length;
    const fileExt = fileName.split('.').pop();
    const contentRange = request.headers['content-range'];

    if (!fileBuffer) {
      throw new Exception(
        Exception.STORAGE_FILE_EMPTY,
        'File buffer is missing.',
      );
    }

    let fileId = input.fileId === 'unique()' ? ID.unique() : input.fileId;
    let chunk = 1;
    let chunks = 1;
    let initialChunkSize = 0;

    if (contentRange) {
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
      if (!match) {
        throw new Exception(
          Exception.STORAGE_INVALID_CONTENT_RANGE,
          'Invalid Content-Range format.',
        );
      }

      const [, start, end, size] = match.map(Number);

      const headerFileId = request.headers['x-nuvix-id'];
      if (Array.isArray(headerFileId)) {
        fileId = headerFileId[0];
      } else if (headerFileId) {
        fileId = headerFileId as string;
      }

      if (end >= size) {
        throw new Exception(Exception.STORAGE_INVALID_CONTENT_RANGE);
      }

      const chunkSize = end - start + 1;
      if (initialChunkSize === 0) {
        initialChunkSize = chunkSize;
      }

      chunks = Math.ceil(size / initialChunkSize);
      chunk = Math.floor(start / initialChunkSize) + 1;
    }

    const allowedFileExtensions = bucket.getAttribute(
      'allowedFileExtensions',
      [],
    );
    if (
      allowedFileExtensions.length &&
      !allowedFileExtensions.includes(fileExt)
    ) {
      throw new Exception(
        Exception.STORAGE_FILE_TYPE_UNSUPPORTED,
        'File extension not allowed',
      );
    }

    if (fileSize > maximumFileSize) {
      throw new Exception(
        Exception.STORAGE_INVALID_FILE_SIZE,
        'File size not allowed',
      );
    }

    const storagePath = `${APP_STORAGE_UPLOADS}/bucket_${bucket.getInternalId()}`;
    const chunksPath = `${storagePath}/chunks/${fileId}`;
    const finalFilePath = `${storagePath}/${fileId}.${fileName.split('.').pop()}`;

    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    if (!fs.existsSync(chunksPath)) {
      fs.mkdirSync(chunksPath, { recursive: true });
    }

    let fileDocument = await db.getDocument(
      'bucket_' + bucket.getInternalId(),
      fileId,
    );

    let metadata = { content_type: file.mimetype };
    let chunksUploaded = 0;

    if (!fileDocument.isEmpty()) {
      const chunksTotal = fileDocument.getAttribute('chunksTotal', 1);
      chunksUploaded = fileDocument.getAttribute('chunksUploaded', 0);
      metadata = fileDocument.getAttribute('metadata', {});
      chunks = chunksTotal;

      if (chunk === -1) chunk = chunksTotal;
      if (chunksUploaded === chunksTotal) {
        throw new Exception(Exception.STORAGE_FILE_ALREADY_EXISTS);
      }
    }

    const chunkPath = `${chunksPath}/part_${chunk}`;
    fs.writeFileSync(chunkPath, fileBuffer);

    chunksUploaded += 1;

    if (chunksUploaded === chunks) {
      const writeStream = fs.createWriteStream(finalFilePath);

      for (let i = 1; i <= chunks; i++) {
        const partPath = `${chunksPath}/part_${i}`;
        if (fs.existsSync(partPath)) {
          writeStream.write(fs.readFileSync(partPath));
          fs.unlinkSync(partPath);
        } else {
          throw new Exception(Exception.STORAGE_FILE_CHUNK_MISSING);
        }
      }

      await new Promise((resolve, reject) => {
        writeStream.end((err: any) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });

      fs.rmSync(chunksPath, { recursive: true });

      const mimeType = file.mimetype;
      const fileHash = await calculateFileHash(finalFilePath);
      const sizeActual = fs.statSync(finalFilePath).size;

      if (fileDocument.isEmpty()) {
        const doc = new Document({
          $id: fileId,
          $permissions: permissions,
          bucketId: bucket.getId(),
          bucketInternalId: bucket.getInternalId(),
          name: fileName,
          path: finalFilePath,
          signature: fileHash,
          mimeType,
          sizeOriginal: fileSize,
          sizeActual,
          chunksTotal: chunks,
          chunksUploaded,
          search: [fileId, fileName].join(' '),
          metadata,
        });

        fileDocument = await db.createDocument(
          'bucket_' + bucket.getInternalId(),
          doc,
        );
      } else {
        fileDocument = fileDocument
          .setAttribute('$permissions', permissions)
          .setAttribute('signature', fileHash)
          .setAttribute('mimeType', mimeType)
          .setAttribute('sizeActual', sizeActual)
          .setAttribute('metadata', metadata)
          .setAttribute('chunksUploaded', chunksUploaded);

        const validator = new Authorization(Database.PERMISSION_CREATE);
        if (!validator.isValid(bucket.getCreate())) {
          throw new Exception(Exception.USER_UNAUTHORIZED);
        }

        fileDocument = await Authorization.skip(async () =>
          db.updateDocument(
            'bucket_' + bucket.getInternalId(),
            fileId,
            fileDocument,
          ),
        );
      }
    } else {
      if (fileDocument.isEmpty()) {
        const doc = new Document({
          $id: fileId,
          $permissions: permissions,
          bucketId: bucket.getId(),
          bucketInternalId: bucket.getInternalId(),
          name: fileName,
          path: finalFilePath,
          signature: '',
          mimeType: '',
          sizeOriginal: fileSize,
          sizeActual: 0,
          chunksTotal: chunks,
          chunksUploaded,
          search: [fileId, fileName].join(' '),
          metadata,
        });

        fileDocument = await db.createDocument(
          'bucket_' + bucket.getInternalId(),
          doc,
        );
      } else {
        const updatedDoc = fileDocument
          .setAttribute('chunksUploaded', chunksUploaded)
          .setAttribute('metadata', metadata);

        fileDocument = await db.updateDocument(
          'bucket_' + bucket.getInternalId(),
          fileId,
          updatedDoc,
        );
      }
    }

    return fileDocument;
  }

  /**
   * Upload File
   */
  async uploadFile(
    db: Database,
    bucketId: string,
    input: UploadFileDTO,
    file: MultipartFile,
    request: FastifyRequest,
    user: Document,
    mode: string,
  ) {}

  /**
   * Get a File.
   */
  async getFile(db: Database, bucketId: string, fileId: string) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.getAttribute('fileSecurity', false);
    const validator = new Authorization(Database.PERMISSION_READ);
    const valid = validator.isValid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file =
      fileSecurity && !valid
        ? await db.getDocument('bucket_' + bucket.getInternalId(), fileId)
        : await Authorization.skip(() =>
            db.getDocument('bucket_' + bucket.getInternalId(), fileId),
          );

    if (file.isEmpty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    return file;
  }

  /**
   * Preview a file.
   * @todo
   */
  async previewFile(
    db: Database,
    bucketId: string,
    fileId: string,
    params: PreviewParams,
  ) {
    const {
      width,
      height,
      gravity,
      quality,
      borderWidth,
      borderColor,
      borderRadius,
      opacity,
      rotation,
      background,
      output,
    } = params;

    const bucket = await Authorization.skip(
      async () => await db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.getAttribute('fileSecurity', false);
    const validator = new Authorization(Database.PERMISSION_READ);
    const valid = validator.isValid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file =
      fileSecurity && !valid
        ? await db.getDocument('bucket_' + bucket.getInternalId(), fileId)
        : await Authorization.skip(
            async () =>
              await db.getDocument('bucket_' + bucket.getInternalId(), fileId),
          );

    if (file.isEmpty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    const path = file.getAttribute('path', '');

    if (!fs.existsSync(path)) {
      throw new Exception(
        Exception.STORAGE_FILE_NOT_FOUND,
        'File not found in ' + path,
      );
    }

    const mimeType = file.getAttribute('mimeType');
    const fileName = file.getAttribute('name', '');
    const size = file.getAttribute('sizeOriginal', 0);

    let image = sharp(path);

    if (width || height) {
      image = image.resize(width, height, {
        fit: sharp.fit.cover,
        position: gravity,
      });
    }

    if (borderWidth) {
      image = image.extend({
        top: borderWidth,
        bottom: borderWidth,
        left: borderWidth,
        right: borderWidth,
        background: borderColor,
      });
    }

    if (borderRadius) {
      image = image.composite([
        {
          input: Buffer.from(
            `<svg><rect x="0" y="0" width="${width}" height="${height}" rx="${borderRadius}" ry="${borderRadius}"/></svg>`,
          ),
          blend: 'dest-in',
        },
      ]);
    }

    if (opacity !== undefined) {
      image = image.composite([
        {
          input: Buffer.from(
            `<svg><rect x="0" y="0" width="${width}" height="${height}" fill="rgba(255, 255, 255, ${opacity})"/></svg>`,
          ),
          blend: 'dest-in',
        },
      ]);
    }

    if (rotation) {
      image = image.rotate(rotation);
    }

    if (background) {
      image = image.flatten({ background });
    }

    const outputFormat = output || mimeType.split('/')[1];
    const buffer = await image.toFormat(outputFormat, { quality }).toBuffer();

    return new StreamableFile(buffer, {
      type: `image/${outputFormat}`,
      disposition: `inline; filename="${fileName}"`,
      length: buffer.length,
    });
  }

  /**
   * Download a file.
   */
  async downloadFile(
    db: Database,
    bucketId: string,
    fileId: string,
    response: FastifyReply,
    request: FastifyRequest,
  ) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.getAttribute('fileSecurity', false);
    const validator = new Authorization(Database.PERMISSION_READ);
    const valid = validator.isValid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file =
      fileSecurity && !valid
        ? await db.getDocument('bucket_' + bucket.getInternalId(), fileId)
        : await Authorization.skip(() =>
            db.getDocument('bucket_' + bucket.getInternalId(), fileId),
          );

    if (file.isEmpty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    const path = file.getAttribute('path', '');

    if (!fs.existsSync(path)) {
      throw new Exception(
        Exception.STORAGE_FILE_NOT_FOUND,
        'File not found in ' + path,
      );
    }

    const mimeType = file.getAttribute('mimeType');
    const fileName = file.getAttribute('name', '');
    const size = file.getAttribute('sizeOriginal', 0);

    const rangeHeader = request.headers['range'];
    let start = 0;
    let end = size - 1;

    if (rangeHeader) {
      const [unit, range] = rangeHeader.split('=');
      if (unit !== 'bytes') {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      const [rangeStart, rangeEnd] = range.split('-').map(Number);
      start = rangeStart;
      end = rangeEnd || end;

      if (start >= end || end >= size) {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      response.header('Accept-Ranges', 'bytes');
      response.header('Content-Range', `bytes ${start}-${end}/${size}`);
      response.header('Content-Length', end - start + 1);
      response.status(206);
    } else {
      response.header('Content-Length', size);
    }

    response.header('Content-Type', mimeType);
    response.header(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    response.header(
      'Expires',
      new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toUTCString(),
    );

    const fileStream = fs.createReadStream(path, { start, end });
    return new StreamableFile(fileStream);
  }

  /**
   * View a file.
   */
  async viewFile(
    db: Database,
    bucketId: string,
    fileId: string,
    response: FastifyReply,
    request: FastifyRequest,
  ) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.getAttribute('fileSecurity', false);
    const validator = new Authorization(Database.PERMISSION_READ);
    const valid = validator.isValid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file =
      fileSecurity && !valid
        ? await db.getDocument('bucket_' + bucket.getInternalId(), fileId)
        : await Authorization.skip(() =>
            db.getDocument('bucket_' + bucket.getInternalId(), fileId),
          );

    if (file.isEmpty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    const path = file.getAttribute('path', '');

    if (!fs.existsSync(path)) {
      throw new Exception(
        Exception.STORAGE_FILE_NOT_FOUND,
        'File not found in ' + path,
      );
    }

    const mimeType = file.getAttribute('mimeType');
    const fileName = file.getAttribute('name', '');
    const size = file.getAttribute('sizeOriginal', 0);

    const rangeHeader = request.headers['range'];
    let start = 0;
    let end = size - 1;

    if (rangeHeader) {
      const [unit, range] = rangeHeader.split('=');
      if (unit !== 'bytes') {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      const [rangeStart, rangeEnd] = range.split('-').map(Number);
      start = rangeStart;
      end = rangeEnd || end;

      if (start >= end || end >= size) {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      response.header('Accept-Ranges', 'bytes');
      response.header('Content-Range', `bytes ${start}-${end}/${size}`);
      response.header('Content-Length', end - start + 1);
      response.status(206);
    } else {
      response.header('Content-Length', size);
    }

    response.header('Content-Type', mimeType);
    response.header('Content-Disposition', `inline; filename="${fileName}"`);
    response.header(
      'Expires',
      new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toUTCString(),
    );

    const fileStream = fs.createReadStream(path, { start, end });
    return new StreamableFile(fileStream);
  }

  /**
   * Get file for push notification
   */
  async getFileForPushNotification(
    db: Database,
    bucketId: string,
    fileId: string,
    jwt: string,
    request: FastifyRequest,
    response: FastifyReply,
  ) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    let decoded: any;
    try {
      decoded = this.jwtService.verify(jwt);
    } catch (error) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    if (
      decoded.projectId !== bucket.getAttribute('projectId') ||
      decoded.bucketId !== bucketId ||
      decoded.fileId !== fileId
    ) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const file = await Authorization.skip(() =>
      db.getDocument('bucket_' + bucket.getInternalId(), fileId),
    );

    if (file.isEmpty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    const path = file.getAttribute('path', '');

    if (!fs.existsSync(path)) {
      throw new Exception(
        Exception.STORAGE_FILE_NOT_FOUND,
        'File not found in ' + path,
      );
    }

    const mimeType = file.getAttribute('mimeType', 'text/plain');
    const fileName = file.getAttribute('name', '');
    const size = file.getAttribute('sizeOriginal', 0);

    response.header('Content-Type', mimeType);
    response.header('Content-Disposition', `inline; filename="${fileName}"`);
    response.header(
      'Expires',
      new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toUTCString(),
    );
    response.header('X-Peak', process.memoryUsage().heapUsed.toString());

    const rangeHeader = request.headers['range'];
    if (rangeHeader) {
      const [unit, range] = rangeHeader.split('=');
      if (unit !== 'bytes') {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      const [start, end] = range.split('-').map(Number);
      const finalEnd = end || size - 1;

      if (start >= finalEnd || finalEnd >= size) {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      response.header('Accept-Ranges', 'bytes');
      response.header('Content-Range', `bytes ${start}-${finalEnd}/${size}`);
      response.header('Content-Length', finalEnd - start + 1);
      response.status(206);

      const fileStream = fs.createReadStream(path, { start, end: finalEnd });
      return new StreamableFile(fileStream);
    }

    response.header('Content-Length', size);
    const fileStream = fs.createReadStream(path);
    return new StreamableFile(fileStream);
  }

  /**
   * Update a file.
   */
  async updateFile(
    db: Database,
    bucketId: string,
    fileId: string,
    input: UpdateFileDTO,
  ) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.getAttribute('fileSecurity', false);
    const validator = new Authorization(Database.PERMISSION_UPDATE);
    const valid = validator.isValid(bucket.getUpdate());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file = await Authorization.skip(() =>
      db.getDocument('bucket_' + bucket.getInternalId(), fileId),
    );

    if (file.isEmpty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    let permissions = Permission.aggregate(input.permissions ?? [], [
      Database.PERMISSION_READ,
      Database.PERMISSION_UPDATE,
      Database.PERMISSION_DELETE,
    ]);

    const roles = Authorization.getRoles();
    if (
      !Auth.isAppUser(roles) &&
      !Auth.isPrivilegedUser(roles) &&
      permissions
    ) {
      permissions.forEach(permission => {
        const parsedPermission = Permission.parse(permission);
        if (!Authorization.isRole(parsedPermission.toString())) {
          throw new Exception(
            Exception.USER_UNAUTHORIZED,
            `Permissions must be one of: (${roles.join(', ')})`,
          );
        }
      });
    }

    if (!permissions) {
      permissions = file.getPermissions() ?? [];
    }

    file.setAttribute('$permissions', permissions);

    if (input.name) {
      file.setAttribute('name', input.name);
    }

    if (fileSecurity && !valid) {
      return await db.updateDocument(
        'bucket_' + bucket.getInternalId(),
        fileId,
        file,
      );
    } else {
      return await Authorization.skip(() =>
        db.updateDocument('bucket_' + bucket.getInternalId(), fileId, file),
      );
    }
  }

  /**
   * Delete a file.
   */
  async deleteFile(db: Database, bucketId: string, fileId: string) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.isEmpty() ||
      (!bucket.getAttribute('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.getAttribute('fileSecurity', false);
    const validator = new Authorization(Database.PERMISSION_DELETE);
    const valid = validator.isValid(bucket.getDelete());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file = await Authorization.skip(() =>
      db.getDocument('bucket_' + bucket.getInternalId(), fileId),
    );

    if (file.isEmpty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    if (fileSecurity && !valid && !validator.isValid(file.getDelete())) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const filePath = file.getAttribute('path');
    let deviceDeleted = false;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deviceDeleted = true;
    }

    if (deviceDeleted) {
      const deleted =
        fileSecurity && !valid
          ? await db.deleteDocument('bucket_' + bucket.getInternalId(), fileId)
          : await Authorization.skip(
              async () =>
                await db.deleteDocument(
                  'bucket_' + bucket.getInternalId(),
                  fileId,
                ),
            );

      if (!deleted) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Failed to remove file from DB',
        );
      }
    } else {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to delete file from device',
      );
    }

    return {};
  }

  /**
   * Get Storage Usage.
   */
  async getStorageUsage(db: Database, range?: string) {
    const periods = usageConfig;

    const stats: any = {};
    const usage: any = {};
    const days = periods[range];
    const metrics = ['buckets', 'files', 'filesStorage'];

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result = await db.findOne('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', ['inf']),
        ]);

        stats[metric] = { total: result.getAttribute('value') ?? 0, data: {} };
        const results = await db.find('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', days.period),
          Query.limit(days.limit),
          Query.orderDesc('time'),
        ]);

        for (const res of results) {
          stats[metric].data[res.getAttribute('time')] = {
            value: res.getAttribute('value'),
          };
        }
      }
    });

    const format =
      days.period === '1h'
        ? 'YYYY-MM-DDTHH:00:00.000Z'
        : 'YYYY-MM-DDT00:00:00.000Z';

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] };
      let leap = Math.floor(Date.now() / 1000) - days.limit * days.factor;

      while (leap < Math.floor(Date.now() / 1000)) {
        leap += days.factor;
        const formatDate =
          new Date(leap * 1000).toISOString().split('.')[0] + 'Z';
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        });
      }
    }

    return {
      range,
      bucketsTotal: usage.buckets?.total,
      filesTotal: usage.files?.total,
      filesStorageTotal: usage.filesStorage?.total,
      buckets: usage.buckets?.data,
      files: usage.files?.data,
      storage: usage.filesStorage?.data,
    };
  }

  /**
   * Get Storage Usage of bucket.
   */
  async getBucketStorageUsage(db: Database, bucketId: string, range?: string) {
    const bucket = await db.getDocument('buckets', bucketId);

    if (bucket.isEmpty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const periods = usageConfig;

    const stats: any = {};
    const usage: any = {};
    const days = periods[range];
    const metrics = [
      `bucket_${bucket.getInternalId()}_files`,
      `bucket_${bucket.getInternalId()}_filesStorage`,
    ];

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result = await db.findOne('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', ['inf']),
        ]);

        stats[metric] = { total: result.getAttribute('value') ?? 0, data: {} };
        const results = await db.find('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', days.period),
          Query.limit(days.limit),
          Query.orderDesc('time'),
        ]);

        for (const res of results) {
          stats[metric].data[res.getAttribute('time')] = {
            value: res.getAttribute('value'),
          };
        }
      }
    });

    const format =
      days.period === '1h'
        ? 'YYYY-MM-DDTHH:00:00.000Z'
        : 'YYYY-MM-DDT00:00:00.000Z';

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] };
      let leap = Math.floor(Date.now() / 1000) - days.limit * days.factor;

      while (leap < Math.floor(Date.now() / 1000)) {
        leap += days.factor;
        const formatDate =
          new Date(leap * 1000).toISOString().split('.')[0] + 'Z';
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        });
      }
    }

    return {
      range,
      filesTotal: usage[metrics[0]]?.total,
      filesStorageTotal: usage[metrics[1]]?.total,
      files: usage[metrics[0]]?.data,
      storage: usage[metrics[1]]?.data,
    };
  }
}

/**
 * Calculate file hash.
 */
function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

interface PreviewParams {
  width?: number;
  height?: number;
  gravity?: string;
  quality?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  opacity?: number;
  rotation?: number;
  background?: string;
  output?: string;
}
