import { Inject, Injectable } from '@nestjs/common';
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
  DB_FOR_CONSOLE,
  DB_FOR_PROJECT,
} from 'src/Utils/constants';
import { CreateBucketDTO, UpdateBucketDTO } from './DTO/bucket.dto';
import collections from 'src/core/collections';
import { Auth } from 'src/core/helper/auth.helper';
import { CreateFileDTO } from './DTO/file.dto';
import { Request } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';

@Injectable()
export class StorageService {
  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly dbForConsole: Database,
    @Inject(DB_FOR_PROJECT) private readonly db: Database,
  ) {}

  /**
   * Get buckets.
   */
  async getBuckets(queries: any, search?: string) {
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
      const cursorDocument = await this.db.getDocument('buckets', bucketId);

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
      buckets: await this.db.find('buckets', queries),
      total: await this.db.count('buckets', filterQueries, APP_LIMIT_COUNT),
    };
  }

  /**
   * Create bucket.
   */
  async createBucket(input: CreateBucketDTO) {
    const bucketId =
      input.bucketId === 'unique()' ? ID.unique() : input.bucketId;

    // Map aggregate permissions into the multiple permissions they represent.
    const permissions = Permission.aggregate(input.permissions ?? []);

    try {
      const files = (collections['buckets'] ?? {})['files'] ?? {};
      if (!files) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Files collection is not configured.',
        );
      }

      const attributes = files['attributes'].map(
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

      const indexes = files['indexes'].map(
        (index: any) =>
          new Document({
            $id: index.$id,
            type: index.type,
            attributes: index.attributes,
            lengths: index.lengths,
            orders: index.orders,
          }),
      );

      await this.db.createDocument(
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

      const bucket = await this.db.getDocument('buckets', bucketId);

      await this.db.createCollection({
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
  async getBucket(id: string) {
    const bucket = await this.db.getDocument('buckets', id);

    if (bucket.isEmpty())
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);

    return bucket;
  }

  /**
   * Update a bucket.
   */
  async updateBucket(id: string, input: UpdateBucketDTO) {
    const bucket = await this.db.getDocument('buckets', id);

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

    const updatedBucket = await this.db.updateDocument(
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

    await this.db.updateCollection(
      'bucket_' + bucket.getInternalId(),
      permissions,
      input.fileSecurity,
    );

    return updatedBucket;
  }

  /**
   * Delete a bucket.
   */
  async deleteBucket(id: string) {
    const bucket = await this.db.getDocument('buckets', id);

    if (bucket.isEmpty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    if (!(await this.db.deleteDocument('buckets', id))) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove bucket from DB',
      );
    }

    await this.db.deleteCollection('bucket_' + bucket.getInternalId()); // TODO: use queues to delete
    return {};
  }

  /**
   * Get files.
   */
  async getFiles(bucketId: string, queries: Query[], search?: string) {
    const bucket = await this.db.getDocument('buckets', bucketId);

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
          ? await this.db.getDocument(
              'bucket_' + bucket.getInternalId(),
              fileId,
            )
          : await Authorization.skip(() =>
              this.db.getDocument('bucket_' + bucket.getInternalId(), fileId),
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
        ? await this.db.find('bucket_' + bucket.getInternalId(), queries)
        : await Authorization.skip(() =>
            this.db.find('bucket_' + bucket.getInternalId(), queries),
          );

    const total =
      fileSecurity && !valid
        ? await this.db.count(
            'bucket_' + bucket.getInternalId(),
            filterQueries,
            APP_LIMIT_COUNT,
          )
        : await Authorization.skip(() =>
            this.db.count(
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
   * Create|Upload file.
   */
  async createFile(
    bucketId: string,
    input: CreateFileDTO,
    files: Array<Express.Multer.File>,
    request: Request,
    user: Document,
    mode: string,
  ) {
    const bucket = await Authorization.skip(() =>
      this.db.getDocument('buckets', bucketId),
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

    const permissions = Permission.aggregate(
      input.permissions,
      allowedPermissions,
    );

    if (!permissions) {
      if (user.getId()) {
        allowedPermissions.forEach((permission) => {
          permissions.push(
            new Permission(permission, 'user', user.getId()).toString(),
          );
        });
      }
    }

    const roles = Authorization.getRoles();
    if (!Auth.isAppUser(roles) && !Auth.isPrivilegedUser(roles)) {
      permissions.forEach((permission) => {
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

    const file = files[0];
    if (!file) {
      throw new Exception(Exception.STORAGE_FILE_EMPTY);
    }

    const fileName = file.originalname;
    const fileTmpName = file.path;
    const fileSize = file.size;

    const contentRange = request.headers['content-range'];
    let fileId = input.fileId === 'unique()' ? ID.unique() : input.fileId;
    let chunk = 1;
    let chunks = 1;

    if (contentRange) {
      const [start, end, size] = contentRange.split(/[-/]/).map(Number);
      fileId = (request.headers['x-nuvix-id'] as any) || fileId;
      if (end >= size) {
        throw new Exception(Exception.STORAGE_INVALID_CONTENT_RANGE);
      }

      if (end === size - 1) {
        chunks = chunk = -1;
      } else {
        chunks = Math.ceil(size / (end + 1 - start));
        chunk = Math.floor(start / (end + 1 - start)) + 1;
      }
    }

    const allowedFileExtensions = bucket.getAttribute(
      'allowedFileExtensions',
      [],
    );
    if (
      allowedFileExtensions.length &&
      !allowedFileExtensions.includes(fileName.split('.').pop())
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

    const uploadPath = `${APP_STORAGE_UPLOADS}/${fileId}.${fileName.split('.').pop()}`;
    let fileDocument = await this.db.getDocument(
      'bucket_' + bucket.getInternalId(),
      fileId,
    );

    let metadata = { content_type: file.mimetype };
    let chunksUploaded = 0;

    if (!fileDocument.isEmpty()) {
      const chunksTotal = fileDocument.getAttribute('chunksTotal', 1);
      chunksUploaded = fileDocument.getAttribute('chunksUploaded', 0);
      metadata = fileDocument.getAttribute('metadata', {});

      if (chunk === -1) {
        chunk = chunksTotal;
      }
      if (chunksUploaded === chunksTotal) {
        throw new Exception(Exception.STORAGE_FILE_ALREADY_EXISTS);
      }
    }

    const chunkPath = `${uploadPath}.part_${chunk}`;
    fs.writeFileSync(chunkPath, fs.readFileSync(fileTmpName));
    fs.unlinkSync(fileTmpName); // Clean up temp chunk

    chunksUploaded += 1;

    if (chunksUploaded === chunks) {
      // Merge all chunks
      const writeStream = fs.createWriteStream(uploadPath);
      for (let i = 1; i <= chunks; i++) {
        const partPath = `${uploadPath}.part_${i}`;
        if (fs.existsSync(partPath)) {
          writeStream.write(fs.readFileSync(partPath));
          fs.unlinkSync(partPath);
        } else {
          throw new Exception(Exception.STORAGE_FILE_CHUNK_MISSING);
        }
      }

      writeStream.end();

      const mimeType = file.mimetype;
      const fileHash = await calculateFileHash(uploadPath);
      const sizeActual = fs.statSync(uploadPath).size;

      const doc = new Document({
        $id: fileId,
        $permissions: permissions,
        bucketId: bucket.getId(),
        bucketInternalId: bucket.getInternalId(),
        name: fileName,
        path: uploadPath,
        signature: fileHash,
        mimeType,
        sizeOriginal: fileSize,
        sizeActual,
        chunksTotal: chunks,
        chunksUploaded,
        metadata,
      });

      fileDocument = await this.db.createDocument(
        'bucket_' + bucket.getInternalId(),
        doc,
      );
    } else {
      const updatedDoc = fileDocument
        .setAttribute('$permissions', permissions)
        .setAttribute('chunksUploaded', chunksUploaded)
        .setAttribute('metadata', metadata);

      await this.db.updateDocument(
        'bucket_' + bucket.getInternalId(),
        fileId,
        updatedDoc,
      );
    }

    return fileDocument;
  }

  /**
   * Get a File.
   */
  async getFile(bucketId: string, fileId: string) {
    const bucket = await Authorization.skip(() =>
      this.db.getDocument('buckets', bucketId),
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
        ? await this.db.getDocument('bucket_' + bucket.getInternalId(), fileId)
        : await Authorization.skip(() =>
            this.db.getDocument('bucket_' + bucket.getInternalId(), fileId),
          );

    if (file.isEmpty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    return file;
  }
}

function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}
