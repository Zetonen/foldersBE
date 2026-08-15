import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull, QueryFailedError } from 'typeorm';
import { NameConflictService } from '../common/services/name-conflict.service';
import { DataRoom } from '../data-rooms/entities/data-room.entity';
import { DataRoomsService } from '../data-rooms/data-rooms.service';
import {
  BreadcrumbDto,
  CreateFolderDto,
  FolderContentsDto,
  FolderDto,
  FolderItemDto,
  FolderStatsDto,
  ListChildrenQueryDto,
  MoveFolderDto,
  RenameFolderDto,
} from './dto/folder.dto';
import { Folder } from './entities/folder.entity';
import { MAX_FOLDER_DEPTH, PathService } from './path.service';

const UNIQUE_VIOLATION = '23505';
const DEFAULT_LIMIT = 50;

interface ItemRow {
  type: 'FOLDER' | 'FILE';
  id: string;
  name: string;
  size_bytes: string | null;
  mime_type: string | null;
  created_at: Date;
  updated_at: Date;
}

interface Cursor {
  n: string;
  i: string;
}

@Injectable()
export class FoldersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly dataRoomsService: DataRoomsService,
    private readonly pathService: PathService,
    private readonly nameConflictService: NameConflictService,
  ) {}

  async create(userId: string, dto: CreateFolderDto): Promise<FolderDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.dataRoomsService.assertOwnership(userId, dto.dataRoomId, manager);

      const parent = dto.parentId
        ? await this.getFolderOrFail(manager, dto.parentId, dto.dataRoomId)
        : null;

      this.assertDepth(this.pathService.depth(parent?.path ?? null) + 1);

      const name = await this.resolveSiblingName(
        manager,
        dto.dataRoomId,
        parent?.id ?? null,
        dto.name,
      );

      const id = randomUUID();
      const path = this.pathService.buildChildPath(parent?.path ?? null, id);

      try {
        await manager.query(
          `
            INSERT INTO folders (id, data_room_id, parent_id, name, path)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [id, dto.dataRoomId, parent?.id ?? null, name, path],
        );
      } catch (error) {
        throw this.translateUniqueViolation(error);
      }

      return FolderDto.fromEntity(await this.getFolderOrFail(manager, id, dto.dataRoomId));
    });
  }

  async listChildren(
    userId: string,
    folderId: string,
    query: ListChildrenQueryDto,
  ): Promise<FolderContentsDto> {
    const folder = await this.getFolderOrFail(this.dataSource.manager, folderId);
    const room = await this.dataRoomsService.assertOwnership(userId, folder.dataRoomId);

    return this.buildContents(room, folder, query);
  }

  async listRoot(
    userId: string,
    dataRoomId: string,
    query: ListChildrenQueryDto,
  ): Promise<FolderContentsDto> {
    const room = await this.dataRoomsService.assertOwnership(userId, dataRoomId);

    return this.buildContents(room, null, query);
  }

  async rename(userId: string, folderId: string, dto: RenameFolderDto): Promise<FolderDto> {
    return this.dataSource.transaction(async (manager) => {
      const folder = await this.getFolderOrFail(manager, folderId);
      await this.dataRoomsService.assertOwnership(userId, folder.dataRoomId, manager);

      const name = await this.resolveSiblingName(
        manager,
        folder.dataRoomId,
        folder.parentId,
        dto.name,
        folder.id,
      );

      try {
        await manager.query(
          `UPDATE folders SET name = $2, updated_at = now() WHERE id = $1 AND data_room_id = $3`,
          [folder.id, name, folder.dataRoomId],
        );
      } catch (error) {
        throw this.translateUniqueViolation(error);
      }

      return FolderDto.fromEntity(
        await this.getFolderOrFail(manager, folder.id, folder.dataRoomId),
      );
    });
  }

  async move(userId: string, folderId: string, dto: MoveFolderDto): Promise<FolderDto> {
    return this.dataSource.transaction(async (manager) => {
      const folder = await this.getFolderOrFail(manager, folderId);
      await this.dataRoomsService.assertOwnership(userId, folder.dataRoomId, manager);

      const parent = dto.parentId
        ? await this.getFolderOrFail(manager, dto.parentId, folder.dataRoomId)
        : null;

      if (parent && this.pathService.isDescendantOrSelf(parent.path, folder.path)) {
        throw new BadRequestException('A folder cannot be moved into itself or its own descendant');
      }

      const subtreeDepth = await this.pathService.maxSubtreeDepth(
        manager,
        folder.dataRoomId,
        folder.path,
      );
      const relativeDepth = subtreeDepth - this.pathService.depth(folder.path);
      this.assertDepth(this.pathService.depth(parent?.path ?? null) + 1 + relativeDepth);

      const name = await this.resolveSiblingName(
        manager,
        folder.dataRoomId,
        parent?.id ?? null,
        folder.name,
        folder.id,
      );

      const newPath = this.pathService.buildChildPath(parent?.path ?? null, folder.id);

      if (newPath !== folder.path) {
        await this.pathService.rewriteSubtreePaths(
          manager,
          folder.dataRoomId,
          folder.path,
          newPath,
        );
      }

      try {
        await manager.query(
          `UPDATE folders SET parent_id = $2, name = $3, updated_at = now() WHERE id = $1 AND data_room_id = $4`,
          [folder.id, parent?.id ?? null, name, folder.dataRoomId],
        );
      } catch (error) {
        throw this.translateUniqueViolation(error);
      }

      return FolderDto.fromEntity(
        await this.getFolderOrFail(manager, folder.id, folder.dataRoomId),
      );
    });
  }

  async softDelete(userId: string, folderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const folder = await this.getFolderOrFail(manager, folderId);
      await this.dataRoomsService.assertOwnership(userId, folder.dataRoomId, manager);

      const pattern = this.pathService.subtreePattern(folder.path);

      await manager.query(
        `
          UPDATE files SET deleted_at = now()
          WHERE data_room_id = $1 AND deleted_at IS NULL AND folder_id IN (
            SELECT id FROM folders WHERE data_room_id = $1 AND path LIKE $2 AND deleted_at IS NULL
          )
        `,
        [folder.dataRoomId, pattern],
      );
      await manager.query(
        `UPDATE folders SET deleted_at = now() WHERE data_room_id = $1 AND path LIKE $2 AND deleted_at IS NULL`,
        [folder.dataRoomId, pattern],
      );
    });
  }

  async stats(userId: string, folderId: string): Promise<FolderStatsDto> {
    const folder = await this.getFolderOrFail(this.dataSource.manager, folderId);
    await this.dataRoomsService.assertOwnership(userId, folder.dataRoomId);

    const rows: Array<{ folder_count: string; file_count: string; total_size: string }> =
      await this.dataSource.query(
        `
          WITH subtree AS (
            SELECT id FROM folders
            WHERE data_room_id = $1 AND path LIKE $2 AND deleted_at IS NULL
          ), file_totals AS (
            SELECT count(*) AS file_count, coalesce(sum(size_bytes), 0) AS total_size
            FROM files
            WHERE data_room_id = $1 AND deleted_at IS NULL
              AND folder_id IN (SELECT id FROM subtree)
          )
          SELECT (SELECT count(*) FROM subtree) - 1 AS folder_count,
                 file_totals.file_count,
                 file_totals.total_size
          FROM file_totals
        `,
        [folder.dataRoomId, this.pathService.subtreePattern(folder.path)],
      );

    return {
      totalSize: Number(rows[0].total_size),
      fileCount: Number(rows[0].file_count),
      folderCount: Number(rows[0].folder_count),
    };
  }

  private async buildContents(
    room: DataRoom,
    folder: Folder | null,
    query: ListChildrenQueryDto,
  ): Promise<FolderContentsDto> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const cursor = this.decodeCursor(query.cursor);
    const parentId = folder?.id ?? null;

    const params: unknown[] = [room.id];
    const parentCondition = parentId
      ? { folders: `parent_id = $${params.push(parentId)}`, files: `folder_id = $${params.length}` }
      : { folders: 'parent_id IS NULL', files: 'folder_id IS NULL' };
    const cursorName = params.push(cursor?.n ?? null);
    const cursorId = params.push(cursor?.i ?? null);
    const limitParam = params.push(limit + 1);

    const rows: ItemRow[] = await this.dataSource.query(
      `
        SELECT * FROM (
          SELECT 'FOLDER' AS type, id, name, NULL::bigint AS size_bytes, NULL::text AS mime_type,
                 created_at, updated_at
          FROM folders
          WHERE data_room_id = $1 AND ${parentCondition.folders} AND deleted_at IS NULL
          UNION ALL
          SELECT 'FILE' AS type, id, name, size_bytes, mime_type, created_at, updated_at
          FROM files
          WHERE data_room_id = $1 AND ${parentCondition.files} AND deleted_at IS NULL
        ) AS items
        WHERE $${cursorName}::text IS NULL OR (name, id) > ($${cursorName}::text, $${cursorId}::uuid)
        ORDER BY name, id
        LIMIT $${limitParam}
      `,
      params,
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      dataRoom: { id: room.id, name: room.name },
      folder: folder ? FolderDto.fromEntity(folder) : null,
      breadcrumbs: folder ? await this.buildBreadcrumbs(folder) : [],
      items: page.map((row) => this.toItemDto(row)),
      nextCursor: hasMore && last ? this.encodeCursor({ n: last.name, i: last.id }) : null,
    };
  }

  private async buildBreadcrumbs(folder: Folder): Promise<BreadcrumbDto[]> {
    const ancestorIds = this.pathService.parseIds(folder.path).slice(0, -1);

    if (ancestorIds.length === 0) {
      return [];
    }

    const rows: Array<{ id: string; name: string }> = await this.dataSource.query(
      `SELECT id, name FROM folders WHERE data_room_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
      [folder.dataRoomId, ancestorIds],
    );

    const byId = new Map(rows.map((row) => [row.id, row.name]));

    return ancestorIds
      .filter((id) => byId.has(id))
      .map((id) => ({ id, name: byId.get(id) as string }));
  }

  private toItemDto(row: ItemRow): FolderItemDto {
    return {
      type: row.type,
      id: row.id,
      name: row.name,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      mimeType: row.mime_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async resolveSiblingName(
    manager: EntityManager,
    dataRoomId: string,
    parentId: string | null,
    desiredName: string,
    excludeFolderId?: string,
  ): Promise<string> {
    const params: unknown[] = [dataRoomId];
    const parentCondition = parentId
      ? `parent_id = $${params.push(parentId)}`
      : 'parent_id IS NULL';
    const pattern = params.push(
      this.nameConflictService.buildLikePattern(desiredName, { splitExtension: false }),
    );
    const exclusion = excludeFolderId ? `AND id <> $${params.push(excludeFolderId)}` : '';

    const rows: Array<{ name: string }> = await manager.query(
      `
        SELECT name FROM folders
        WHERE data_room_id = $1 AND ${parentCondition} AND deleted_at IS NULL
          AND name LIKE $${pattern} ${exclusion}
      `,
      params,
    );

    return this.nameConflictService.resolve(
      desiredName,
      rows.map((row) => row.name),
      { splitExtension: false },
    );
  }

  private async getFolderOrFail(
    manager: EntityManager,
    folderId: string,
    expectedDataRoomId?: string,
  ): Promise<Folder> {
    const folder = await manager.getRepository(Folder).findOne({
      where: { id: folderId, deletedAt: IsNull() },
    });

    if (!folder || (expectedDataRoomId && folder.dataRoomId !== expectedDataRoomId)) {
      throw new NotFoundException('Folder not found');
    }

    return folder;
  }

  private assertDepth(depth: number): void {
    if (depth > MAX_FOLDER_DEPTH) {
      throw new BadRequestException(`Folder nesting is limited to ${MAX_FOLDER_DEPTH} levels`);
    }
  }

  private translateUniqueViolation(error: unknown): Error {
    if (error instanceof QueryFailedError && (error as { code?: string }).code === UNIQUE_VIOLATION) {
      return new ConflictException('A folder with this name already exists here');
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  private encodeCursor(cursor: Cursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(raw?: string): Cursor | null {
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;

      if (typeof parsed.n !== 'string' || typeof parsed.i !== 'string') {
        throw new Error('malformed');
      }

      return parsed;
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }
}
