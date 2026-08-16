import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { AccessResolverService } from '../access/access-resolver.service';
import { AccessActor } from '../access/access.types';
import { Role, satisfies } from '../access/role.enum';
import { UsersService } from '../users/users.service';
import { CreateShareDto, ShareDto, SharedWithMeItemDto } from './dto/share.dto';
import { ShareKind, ShareResourceType, ShareRole } from './enums/share.enums';

interface ShareRow {
  id: string;
  resource_type: ShareResourceType;
  resource_id: string;
  kind: ShareKind;
  role: ShareRole;
  grantee_email: string | null;
  grantee_user_id: string | null;
  token: string | null;
  expires_at: Date | null;
  created_at: Date;
}

interface SharedWithMeRow extends ShareRow {
  room_id: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  folder_name: string | null;
  folder_path: string | null;
  file_name: string | null;
  file_folder_path: string | null;
  room_name: string;
}

const SHARE_COLUMNS = `id, resource_type, resource_id, kind, role, grantee_email, grantee_user_id, token, expires_at, created_at`;

@Injectable()
export class SharesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly accessResolver: AccessResolverService,
  ) {}

  async create(actor: AccessActor, dto: CreateShareDto): Promise<ShareDto> {
    const expiresAt = this.parseExpiry(dto.expiresAt);

    if (dto.kind === ShareKind.PublicLink) {
      return this.createPublicLink(actor, dto, expiresAt);
    }

    return this.createUserShare(actor, dto, expiresAt);
  }

  async listForResource(
    resourceType: ShareResourceType,
    resourceId: string,
  ): Promise<ShareDto[]> {
    const rows: ShareRow[] = await this.dataSource.query(
      `
        SELECT ${SHARE_COLUMNS} FROM shares
        WHERE resource_type = $1::share_resource_type_enum AND resource_id = $2
          AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC
      `,
      [resourceType, resourceId],
    );

    return rows.map((row) => this.toDto(row));
  }

  async revoke(actor: AccessActor, shareId: string): Promise<void> {
    const rows: ShareRow[] = await this.dataSource.query(
      `SELECT ${SHARE_COLUMNS} FROM shares WHERE id = $1 AND revoked_at IS NULL`,
      [shareId],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Share not found');
    }

    const share = rows[0];
    const decision = await this.accessResolver.resolve({
      actor,
      token: null,
      resourceType: share.resource_type,
      resourceId: share.resource_id,
    });

    if (!decision) {
      throw new NotFoundException('Share not found');
    }

    if (!satisfies(decision.role, Role.Owner)) {
      throw new ForbiddenException('Only the owner can revoke a share');
    }

    await this.dataSource.query(`UPDATE shares SET revoked_at = now() WHERE id = $1`, [shareId]);
  }

  async findActiveByToken(token: string): Promise<ShareDto> {
    const rows: ShareRow[] = await this.dataSource.query(
      `
        SELECT ${SHARE_COLUMNS} FROM shares
        WHERE token = $1 AND kind = 'PUBLIC_LINK' AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
      `,
      [token],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Share link is invalid or expired');
    }

    return this.toDto(rows[0]);
  }

  async sharedWithMe(actor: AccessActor): Promise<SharedWithMeItemDto[]> {
    const rows: SharedWithMeRow[] = await this.dataSource.query(
      `
        SELECT s.id, s.resource_type, s.resource_id, s.kind, s.role, s.grantee_email,
               s.grantee_user_id, s.token, s.expires_at, s.created_at,
               room.id AS room_id, room.name AS room_name,
               owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
               folder.name AS folder_name, folder.path AS folder_path,
               file.name AS file_name, parent.path AS file_folder_path
        FROM shares s
        LEFT JOIN data_rooms shared_room
          ON s.resource_type = 'DATA_ROOM' AND shared_room.id = s.resource_id AND shared_room.deleted_at IS NULL
        LEFT JOIN folders folder
          ON s.resource_type = 'FOLDER' AND folder.id = s.resource_id AND folder.deleted_at IS NULL
        LEFT JOIN files file
          ON s.resource_type = 'FILE' AND file.id = s.resource_id AND file.deleted_at IS NULL
        LEFT JOIN folders parent ON parent.id = file.folder_id AND parent.deleted_at IS NULL
        JOIN data_rooms room
          ON room.id = COALESCE(shared_room.id, folder.data_room_id, file.data_room_id)
          AND room.deleted_at IS NULL
        JOIN users owner ON owner.id = room.owner_id
        WHERE s.kind = 'USER' AND s.revoked_at IS NULL
          AND (s.expires_at IS NULL OR s.expires_at > now())
          AND (s.grantee_user_id = $1::uuid OR lower(s.grantee_email) = $2::text)
        ORDER BY s.created_at DESC
      `,
      [actor.id, actor.email.toLowerCase()],
    );

    return this.collapseNested(rows);
  }

  private collapseNested(rows: SharedWithMeRow[]): SharedWithMeItemDto[] {
    const unique = new Map<string, SharedWithMeRow>();

    for (const row of rows) {
      if (!unique.has(row.resource_id)) {
        unique.set(row.resource_id, row);
      }
    }

    const entries = [...unique.values()];
    const sharedRoomIds = new Set(
      entries.filter((row) => row.resource_type === ShareResourceType.DataRoom).map((row) => row.room_id),
    );
    const sharedFolders = entries
      .filter((row) => row.resource_type === ShareResourceType.Folder && row.folder_path)
      .map((row) => ({ roomId: row.room_id, path: row.folder_path as string }));

    const visible = entries.filter((row) => {
      if (row.resource_type !== ShareResourceType.DataRoom && sharedRoomIds.has(row.room_id)) {
        return false;
      }

      if (row.resource_type === ShareResourceType.Folder) {
        return !sharedFolders.some(
          (folder) =>
            folder.roomId === row.room_id &&
            folder.path !== row.folder_path &&
            (row.folder_path as string).startsWith(folder.path),
        );
      }

      if (row.resource_type === ShareResourceType.File) {
        const parentPath = row.file_folder_path ?? '';

        return !sharedFolders.some(
          (folder) => folder.roomId === row.room_id && parentPath.startsWith(folder.path),
        );
      }

      return true;
    });

    return visible.map((row) => ({
      type: row.resource_type,
      id: row.resource_id,
      name: this.resourceName(row),
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      sharedAt: row.created_at,
      myRole: Role.Viewer,
    }));
  }

  private resourceName(row: SharedWithMeRow): string {
    switch (row.resource_type) {
      case ShareResourceType.DataRoom:
        return row.room_name;
      case ShareResourceType.Folder:
        return row.folder_name ?? '';
      default:
        return row.file_name ?? '';
    }
  }

  private async createPublicLink(
    actor: AccessActor,
    dto: CreateShareDto,
    expiresAt: Date | null,
  ): Promise<ShareDto> {
    const existing: ShareRow[] = await this.dataSource.query(
      `
        SELECT ${SHARE_COLUMNS} FROM shares
        WHERE resource_id = $1 AND kind = 'PUBLIC_LINK' AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
      `,
      [dto.resourceId],
    );

    if (existing.length > 0) {
      return this.toDto(existing[0]);
    }

    const rows: ShareRow[] = await this.dataSource.query(
      `
        INSERT INTO shares (resource_type, resource_id, kind, role, token, created_by, expires_at)
        VALUES ($1::share_resource_type_enum, $2, 'PUBLIC_LINK', 'VIEWER', $3, $4, $5)
        RETURNING ${SHARE_COLUMNS}
      `,
      [
        dto.resourceType,
        dto.resourceId,
        randomBytes(32).toString('base64url'),
        actor.id,
        expiresAt,
      ],
    );

    return this.toDto(rows[0]);
  }

  private async createUserShare(
    actor: AccessActor,
    dto: CreateShareDto,
    expiresAt: Date | null,
  ): Promise<ShareDto> {
    if (!dto.granteeEmail) {
      throw new BadRequestException('granteeEmail is required for a USER share');
    }

    const email = UsersService.normalizeEmail(dto.granteeEmail);

    if (email === actor.email.toLowerCase()) {
      throw new BadRequestException('You already own this resource');
    }

    const grantee = await this.usersService.findByEmail(email);

    const existing: ShareRow[] = await this.dataSource.query(
      `
        SELECT ${SHARE_COLUMNS} FROM shares
        WHERE resource_id = $1 AND kind = 'USER' AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
          AND lower(grantee_email) = $2
      `,
      [dto.resourceId, email],
    );

    if (existing.length > 0) {
      return this.toDto(existing[0]);
    }

    const rows: ShareRow[] = await this.dataSource.query(
      `
        INSERT INTO shares
          (resource_type, resource_id, kind, role, grantee_user_id, grantee_email, created_by, expires_at)
        VALUES ($1::share_resource_type_enum, $2, 'USER', 'VIEWER', $3, $4, $5, $6)
        RETURNING ${SHARE_COLUMNS}
      `,
      [dto.resourceType, dto.resourceId, grantee?.id ?? null, email, actor.id, expiresAt],
    );

    return this.toDto(rows[0]);
  }

  private parseExpiry(raw?: string): Date | null {
    if (!raw) {
      return null;
    }

    const date = new Date(raw);

    if (date.getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt must be in the future');
    }

    return date;
  }

  private toDto(row: ShareRow): ShareDto {
    return {
      id: row.id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      kind: row.kind,
      role: row.role,
      granteeEmail: row.grantee_email,
      granteeUserId: row.grantee_user_id,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}
