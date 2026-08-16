import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ShareResourceType, ShareRole } from '../shares/enums/share.enums';
import { AccessActor, AccessRepository, ResourceNode, ShareGrant } from './access.types';
import { fromShareRole } from './role.enum';

interface RoomRow {
  id: string;
  owner_id: string;
}

interface FolderRow {
  id: string;
  data_room_id: string;
  path: string;
  owner_id: string;
}

interface FileRow {
  id: string;
  data_room_id: string;
  folder_path: string | null;
  owner_id: string;
}

@Injectable()
export class TypeormAccessRepository implements AccessRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async loadResource(type: ShareResourceType, id: string): Promise<ResourceNode | null> {
    switch (type) {
      case ShareResourceType.DataRoom:
        return this.loadDataRoom(id);
      case ShareResourceType.Folder:
        return this.loadFolder(id);
      case ShareResourceType.File:
        return this.loadFile(id);
      default:
        return null;
    }
  }

  async findGrants(
    resourceIds: string[],
    actor: AccessActor | null,
    token: string | null,
  ): Promise<ShareGrant[]> {
    if (resourceIds.length === 0) {
      return [];
    }

    const rows: Array<{ id: string; resource_id: string; role: ShareRole }> =
      await this.dataSource.query(
        `
          SELECT id, resource_id, role
          FROM shares
          WHERE resource_id = ANY($1::uuid[])
            AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > now())
            AND (
              ($2::uuid IS NOT NULL AND kind = 'USER'
                AND (grantee_user_id = $2::uuid OR lower(grantee_email) = $3::text))
              OR ($4::text IS NOT NULL AND kind = 'PUBLIC_LINK' AND token = $4::text)
            )
        `,
        [resourceIds, actor?.id ?? null, actor?.email.toLowerCase() ?? null, token],
      );

    return rows.map((row) => ({
      id: row.id,
      resourceId: row.resource_id,
      role: fromShareRole(row.role),
    }));
  }

  private async loadDataRoom(id: string): Promise<ResourceNode | null> {
    const rows: RoomRow[] = await this.dataSource.query(
      `SELECT id, owner_id FROM data_rooms WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      type: ShareResourceType.DataRoom,
      id: rows[0].id,
      dataRoomId: rows[0].id,
      ownerId: rows[0].owner_id,
      ancestorIds: [rows[0].id],
    };
  }

  private async loadFolder(id: string): Promise<ResourceNode | null> {
    const rows: FolderRow[] = await this.dataSource.query(
      `
        SELECT f.id, f.data_room_id, f.path, r.owner_id
        FROM folders f
        JOIN data_rooms r ON r.id = f.data_room_id AND r.deleted_at IS NULL
        WHERE f.id = $1 AND f.deleted_at IS NULL
      `,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    return {
      type: ShareResourceType.Folder,
      id: row.id,
      dataRoomId: row.data_room_id,
      ownerId: row.owner_id,
      ancestorIds: [row.data_room_id, ...row.path.split('/').filter(Boolean)],
    };
  }

  private async loadFile(id: string): Promise<ResourceNode | null> {
    const rows: FileRow[] = await this.dataSource.query(
      `
        SELECT fi.id, fi.data_room_id, parent.path AS folder_path, r.owner_id
        FROM files fi
        JOIN data_rooms r ON r.id = fi.data_room_id AND r.deleted_at IS NULL
        LEFT JOIN folders parent ON parent.id = fi.folder_id AND parent.deleted_at IS NULL
        WHERE fi.id = $1 AND fi.deleted_at IS NULL
      `,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const folderIds = row.folder_path ? row.folder_path.split('/').filter(Boolean) : [];

    return {
      type: ShareResourceType.File,
      id: row.id,
      dataRoomId: row.data_room_id,
      ownerId: row.owner_id,
      ancestorIds: [row.data_room_id, ...folderIds, row.id],
    };
  }
}
