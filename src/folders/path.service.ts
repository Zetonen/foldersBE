import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

export const MAX_FOLDER_DEPTH = 20;

@Injectable()
export class PathService {
  buildChildPath(parentPath: string | null, childId: string): string {
    return `${parentPath ?? '/'}${childId}/`;
  }

  parseIds(path: string): string[] {
    return path.split('/').filter((segment) => segment.length > 0);
  }

  depth(path: string | null): number {
    return path === null ? 0 : this.parseIds(path).length;
  }

  isDescendantOrSelf(path: string, ancestorPath: string): boolean {
    return path.startsWith(ancestorPath);
  }

  subtreePattern(path: string): string {
    return `${path}%`;
  }

  async maxSubtreeDepth(
    manager: EntityManager,
    dataRoomId: string,
    path: string,
  ): Promise<number> {
    const rows: Array<{ max_depth: number | null }> = await manager.query(
      `
        SELECT MAX(length(path) - length(replace(path, '/', ''))) - 1 AS max_depth
        FROM folders
        WHERE data_room_id = $1 AND path LIKE $2 AND deleted_at IS NULL
      `,
      [dataRoomId, this.subtreePattern(path)],
    );

    return Number(rows[0]?.max_depth ?? 0);
  }

  async rewriteSubtreePaths(
    manager: EntityManager,
    dataRoomId: string,
    oldPath: string,
    newPath: string,
  ): Promise<void> {
    await manager.query(
      `
        UPDATE folders
        SET path = $3 || substring(path from length($2) + 1),
            updated_at = now()
        WHERE data_room_id = $1 AND path LIKE $4 AND deleted_at IS NULL
      `,
      [dataRoomId, oldPath, newPath, this.subtreePattern(oldPath)],
    );
  }
}
