import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessContext } from '../access/decorators/effective-role.decorator';
import { RequireRole, ResourceTarget } from '../access/decorators/resource-target.decorator';
import { AccessDecision } from '../access/access.types';
import { ResourceAccessGuard } from '../access/guards/resource-access.guard';
import { ShareAwareAuthGuard } from '../access/guards/share-aware-auth.guard';
import { Role } from '../access/role.enum';
import { ShareResourceType } from '../shares/enums/share.enums';
import { FolderContentsDto, ListChildrenQueryDto } from './dto/folder.dto';
import { FoldersService } from './folders.service';

@ApiTags('folders')
@ApiBearerAuth('access-token')
@ApiHeader({ name: 'X-Share-Token', required: false, description: 'Public share token' })
@UseGuards(ShareAwareAuthGuard, ResourceAccessGuard)
@Controller('data-rooms')
export class RoomContentsController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get(':id/root')
  @ResourceTarget({ type: ShareResourceType.DataRoom, from: 'params', key: 'id' })
  @RequireRole(Role.Viewer)
  @ApiOperation({
    summary: 'List folders and files in the data room root',
    description:
      'Same shape as /folders/:id/children, with folder = null and empty breadcrumbs. totalItems counts what sits directly in the root.',
  })
  @ApiOkResponse({ type: FolderContentsDto })
  @ApiBadRequestResponse({ description: 'limit above 100, or a malformed cursor' })
  @ApiNotFoundResponse({ description: 'Data room not found' })
  root(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListChildrenQueryDto,
    @AccessContext() access: AccessDecision,
  ): Promise<FolderContentsDto> {
    return this.foldersService.listRoot(id, query, access);
  }
}
