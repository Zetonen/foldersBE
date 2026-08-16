import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull, QueryFailedError } from 'typeorm';
import { Role } from '../access/role.enum';
import { NameConflictService } from '../common/services/name-conflict.service';
import { FoldersService } from '../folders/folders.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.interface';
import {
  ConfirmUploadDto,
  CreateUploadUrlDto,
  DownloadUrlDto,
  FileDto,
  MoveFileDto,
  RenameFileDto,
  UploadUrlDto,
} from './dto/file.dto';
import { FileEntity } from './entities/file.entity';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class FilesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly configService: ConfigService,
    private readonly foldersService: FoldersService,
    private readonly nameConflictService: NameConflictService,
  ) {}

  async createUploadUrl(dto: CreateUploadUrlDto): Promise<UploadUrlDto> {
    await this.assertFolder(dto.dataRoomId, dto.folderId ?? null);
    this.assertSize(dto.sizeBytes);
    this.assertMimeType(dto.mimeType);

    const name = await this.resolveSiblingName(
      this.dataSource.manager,
      dto.dataRoomId,
      dto.folderId ?? null,
      dto.fileName,
    );
    const storageKey = `${dto.dataRoomId}/${randomUUID()}`;
    const signed = await this.storage.createUploadUrl(storageKey);

    return { uploadUrl: signed.url, token: signed.token, storageKey, name };
  }

  async confirm(dto: ConfirmUploadDto, role: Role): Promise<FileDto> {
    await this.assertFolder(dto.dataRoomId, dto.folderId ?? null);
    this.assertSize(dto.sizeBytes);
    this.assertMimeType(dto.mimeType);

    if (!dto.storageKey.startsWith(`${dto.dataRoomId}/`)) {
      throw new BadRequestException('storageKey does not belong to this data room');
    }

    const stored = await this.storage.head(dto.storageKey);

    if (!stored) {
      throw new BadRequestException('No uploaded object found for this storageKey');
    }

    if (stored.sizeBytes !== null && stored.sizeBytes !== dto.sizeBytes) {
      throw new BadRequestException(
        `Uploaded object is ${stored.sizeBytes} bytes, expected ${dto.sizeBytes}`,
      );
    }

    if (stored.sizeBytes !== null) {
      this.assertSize(stored.sizeBytes);
    }

    return this.dataSource.transaction(async (manager) => {
      const name = await this.resolveSiblingName(
        manager,
        dto.dataRoomId,
        dto.folderId ?? null,
        dto.name,
      );
      const id = randomUUID();

      try {
        await manager.query(
          `
            INSERT INTO files (id, data_room_id, folder_id, name, size_bytes, mime_type, storage_key)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            id,
            dto.dataRoomId,
            dto.folderId ?? null,
            name,
            dto.sizeBytes,
            dto.mimeType,
            dto.storageKey,
          ],
        );
      } catch (error) {
        throw this.translateUniqueViolation(error);
      }

      return this.toDto(manager, await this.getFileOrFail(manager, id), role);
    });
  }

  async findOne(fileId: string, role: Role): Promise<FileDto> {
    const file = await this.getFileOrFail(this.dataSource.manager, fileId);

    return this.toDto(this.dataSource.manager, file, role);
  }

  async createDownloadUrl(fileId: string): Promise<DownloadUrlDto> {
    const file = await this.getFileOrFail(this.dataSource.manager, fileId);

    const expiresIn = this.configService.get<number>('FILE_DOWNLOAD_URL_TTL_SECONDS') ?? 900;
    const url = await this.storage.createDownloadUrl(file.storageKey, expiresIn, file.name);

    return { url, expiresIn };
  }

  async rename(fileId: string, dto: RenameFileDto, role: Role): Promise<FileDto> {
    return this.dataSource.transaction(async (manager) => {
      const file = await this.getFileOrFail(manager, fileId);

      const name = await this.resolveSiblingName(
        manager,
        file.dataRoomId,
        file.folderId,
        dto.name,
        file.id,
      );

      try {
        await manager.query(
          `UPDATE files SET name = $2, updated_at = now()
           WHERE id = $1 AND data_room_id = $3 AND deleted_at IS NULL`,
          [file.id, name, file.dataRoomId],
        );
      } catch (error) {
        throw this.translateUniqueViolation(error);
      }

      return this.toDto(manager, await this.getFileOrFail(manager, file.id), role);
    });
  }

  async move(fileId: string, dto: MoveFileDto, role: Role): Promise<FileDto> {
    return this.dataSource.transaction(async (manager) => {
      const file = await this.getFileOrFail(manager, fileId);
      await this.assertFolder(file.dataRoomId, dto.folderId, manager);

      const name = await this.resolveSiblingName(
        manager,
        file.dataRoomId,
        dto.folderId,
        file.name,
        file.id,
      );

      try {
        await manager.query(
          `UPDATE files SET folder_id = $2, name = $3, updated_at = now()
           WHERE id = $1 AND data_room_id = $4 AND deleted_at IS NULL`,
          [file.id, dto.folderId, name, file.dataRoomId],
        );
      } catch (error) {
        throw this.translateUniqueViolation(error);
      }

      return this.toDto(manager, await this.getFileOrFail(manager, file.id), role);
    });
  }

  async softDelete(fileId: string): Promise<void> {
    const storageKey = await this.dataSource.transaction(async (manager) => {
      const file = await this.getFileOrFail(manager, fileId);

      await manager.query(
        `UPDATE files SET deleted_at = now() WHERE id = $1 AND data_room_id = $2 AND deleted_at IS NULL`,
        [file.id, file.dataRoomId],
      );

      return file.storageKey;
    });

    await this.storage.remove(storageKey);
  }

  private async assertFolder(
    dataRoomId: string,
    folderId: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    if (folderId) {
      await this.foldersService.getFolderInRoom(dataRoomId, folderId, manager);
    }
  }

  private assertSize(sizeBytes: number): void {
    const max = this.configService.get<number>('FILE_MAX_SIZE_BYTES') ?? 104857600;

    if (sizeBytes > max) {
      throw new PayloadTooLargeException(`File exceeds the ${max} byte limit`);
    }
  }

  private assertMimeType(mimeType: string): void {
    const allowed = (this.configService.get<string>('FILE_ALLOWED_MIME_TYPES') ?? 'application/pdf')
      .split(',')
      .map((type) => type.trim().toLowerCase())
      .filter(Boolean);

    if (!allowed.includes(mimeType.toLowerCase())) {
      throw new UnsupportedMediaTypeException(`Allowed MIME types: ${allowed.join(', ')}`);
    }
  }

  private async resolveSiblingName(
    manager: EntityManager,
    dataRoomId: string,
    folderId: string | null,
    desiredName: string,
    excludeFileId?: string,
  ): Promise<string> {
    const params: unknown[] = [dataRoomId];
    const folderCondition = folderId ? `folder_id = $${params.push(folderId)}` : 'folder_id IS NULL';
    const pattern = params.push(
      this.nameConflictService.buildLikePattern(desiredName, { splitExtension: true }),
    );
    const exclusion = excludeFileId ? `AND id <> $${params.push(excludeFileId)}` : '';

    const rows: Array<{ name: string }> = await manager.query(
      `
        SELECT name FROM files
        WHERE data_room_id = $1 AND ${folderCondition} AND deleted_at IS NULL
          AND name LIKE $${pattern} ${exclusion}
      `,
      params,
    );

    return this.nameConflictService.resolve(
      desiredName,
      rows.map((row) => row.name),
      { splitExtension: true },
    );
  }

  private async toDto(manager: EntityManager, file: FileEntity, role: Role): Promise<FileDto> {
    const owner = await this.foldersService.getRoomOwner(file.dataRoomId, manager);

    return FileDto.fromEntity(file, role, owner);
  }

  private async getFileOrFail(manager: EntityManager, fileId: string): Promise<FileEntity> {
    const file = await manager.getRepository(FileEntity).findOne({
      where: { id: fileId, deletedAt: IsNull() },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  private translateUniqueViolation(error: unknown): Error {
    if (error instanceof QueryFailedError && (error as { code?: string }).code === UNIQUE_VIOLATION) {
      return new ConflictException('A file with this name already exists here');
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}
