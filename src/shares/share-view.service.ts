import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessResolverService } from '../access/access-resolver.service';
import { AccessDecision } from '../access/access.types';
import { Role } from '../access/role.enum';
import { FilesService } from '../files/files.service';
import { ListChildrenQueryDto } from '../folders/dto/folder.dto';
import { FoldersService } from '../folders/folders.service';
import { ShareViewDto } from './dto/share-view.dto';
import { ShareResourceType } from './enums/share.enums';
import { SharesService } from './shares.service';

@Injectable()
export class ShareViewService {
  constructor(
    private readonly sharesService: SharesService,
    private readonly accessResolver: AccessResolverService,
    private readonly foldersService: FoldersService,
    private readonly filesService: FilesService,
  ) {}

  async openByToken(token: string, query: ListChildrenQueryDto): Promise<ShareViewDto> {
    const share = await this.sharesService.findActiveByToken(token);
    const decision = await this.accessResolver.resolve({
      actor: null,
      token,
      resourceType: share.resourceType,
      resourceId: share.resourceId,
    });

    if (!decision) {
      throw new NotFoundException('Share link is invalid or expired');
    }

    if (share.resourceType === ShareResourceType.File) {
      const file = await this.filesService.findOne(share.resourceId, decision.role);

      return {
        resourceType: ShareResourceType.File,
        dataRoom: null,
        folder: null,
        file,
        breadcrumbs: [],
        items: [],
        nextCursor: null,
        myRole: decision.role,
      };
    }

    const contents =
      share.resourceType === ShareResourceType.DataRoom
        ? await this.foldersService.listRoot(share.resourceId, query, decision)
        : await this.foldersService.listChildren(share.resourceId, query, decision);

    return {
      resourceType: share.resourceType,
      dataRoom: contents.dataRoom,
      folder: contents.folder,
      file: null,
      breadcrumbs: contents.breadcrumbs,
      items: contents.items,
      nextCursor: contents.nextCursor,
      myRole: contents.myRole,
    };
  }

  async browseFolder(
    folderId: string,
    query: ListChildrenQueryDto,
    access: AccessDecision,
  ): Promise<ShareViewDto> {
    const contents = await this.foldersService.listChildren(folderId, query, access);

    return {
      resourceType: ShareResourceType.Folder,
      dataRoom: contents.dataRoom,
      folder: contents.folder,
      file: null,
      breadcrumbs: contents.breadcrumbs,
      items: contents.items,
      nextCursor: contents.nextCursor,
      myRole: contents.myRole ?? Role.Viewer,
    };
  }
}
