import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessContext } from '../access/decorators/effective-role.decorator';
import { RequireRole, ResourceTarget } from '../access/decorators/resource-target.decorator';
import { AccessDecision } from '../access/access.types';
import { ResourceAccessGuard } from '../access/guards/resource-access.guard';
import { ShareAwareAuthGuard } from '../access/guards/share-aware-auth.guard';
import { Role } from '../access/role.enum';
import { Public } from '../auth/decorators/public.decorator';
import { ListChildrenQueryDto } from '../folders/dto/folder.dto';
import { ShareViewDto } from './dto/share-view.dto';
import { ShareResourceType } from './enums/share.enums';
import { ShareViewService } from './share-view.service';

@ApiTags('shares')
@UseGuards(ShareAwareAuthGuard, ResourceAccessGuard)
@Controller('share')
export class ShareAccessController {
  constructor(private readonly shareViewService: ShareViewService) {}

  @Get(':token')
  @Public()
  @ApiOperation({
    summary: 'Open a public share link',
    description: 'Breadcrumbs start at the share root, folder names above it are never exposed.',
  })
  @ApiOkResponse({ type: ShareViewDto })
  @ApiNotFoundResponse({ description: 'Share link is invalid, revoked or expired' })
  open(
    @Param('token') token: string,
    @Query() query: ListChildrenQueryDto,
  ): Promise<ShareViewDto> {
    return this.shareViewService.openByToken(token, query);
  }

  @Get(':token/folders/:folderId')
  @Public()
  @ResourceTarget({ type: ShareResourceType.Folder, from: 'params', key: 'folderId' })
  @RequireRole(Role.Viewer)
  @ApiOperation({
    summary: 'Navigate inside a public share',
    description:
      'The guard resolves the token against the folder ancestors, so a folder outside the shared subtree returns 404.',
  })
  @ApiOkResponse({ type: ShareViewDto })
  @ApiNotFoundResponse({ description: 'Folder is outside the shared subtree' })
  browse(
    @Param('folderId', ParseUUIDPipe) folderId: string,
    @Query() query: ListChildrenQueryDto,
    @AccessContext() access: AccessDecision,
  ): Promise<ShareViewDto> {
    return this.shareViewService.browseFolder(folderId, query, access);
  }
}
