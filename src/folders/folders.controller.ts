import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessContext, EffectiveRole } from '../access/decorators/effective-role.decorator';
import { RequireRole, ResourceTarget } from '../access/decorators/resource-target.decorator';
import { AccessDecision } from '../access/access.types';
import { ResourceAccessGuard } from '../access/guards/resource-access.guard';
import { ShareAwareAuthGuard } from '../access/guards/share-aware-auth.guard';
import { Role } from '../access/role.enum';
import { ShareResourceType } from '../shares/enums/share.enums';
import {
  CreateFolderDto,
  FolderContentsDto,
  FolderDto,
  FolderStatsDto,
  ListChildrenQueryDto,
  MoveFolderDto,
  RenameFolderDto,
} from './dto/folder.dto';
import { FoldersService } from './folders.service';

@ApiTags('folders')
@ApiBearerAuth('access-token')
@ApiHeader({ name: 'X-Share-Token', required: false, description: 'Public share token' })
@UseGuards(ShareAwareAuthGuard, ResourceAccessGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @ResourceTarget({ type: ShareResourceType.DataRoom, from: 'body', key: 'dataRoomId' })
  @RequireRole(Role.Owner)
  @ApiOperation({
    summary: 'Create a folder',
    description:
      'Builds the materialized path from the parent inside a transaction. Name collisions are resolved with a "(N)" suffix.',
  })
  @ApiOkResponse({ type: FolderDto })
  @ApiBadRequestResponse({ description: 'Nesting deeper than 20 levels' })
  @ApiNotFoundResponse({ description: 'Data room or parent folder not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  create(@Body() dto: CreateFolderDto, @EffectiveRole() role: Role): Promise<FolderDto> {
    return this.foldersService.create(dto, role);
  }

  @Get(':id/children')
  @ResourceTarget({ type: ShareResourceType.Folder, from: 'params', key: 'id' })
  @RequireRole(Role.Viewer)
  @ApiOperation({
    summary: 'List folders and files inside a folder',
    description:
      'Keyset pagination over (name, id). Pass nextCursor back as ?cursor=, a null nextCursor means the last page. limit defaults to 50 and is capped at 100. totalItems counts the direct children of this folder only.',
  })
  @ApiOkResponse({ type: FolderContentsDto })
  @ApiBadRequestResponse({ description: 'limit above 100, or a malformed cursor' })
  @ApiNotFoundResponse({ description: 'Folder not found' })
  children(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListChildrenQueryDto,
    @AccessContext() access: AccessDecision,
  ): Promise<FolderContentsDto> {
    return this.foldersService.listChildren(id, query, access);
  }

  @Get(':id/stats')
  @ResourceTarget({ type: ShareResourceType.Folder, from: 'params', key: 'id' })
  @RequireRole(Role.Viewer)
  @ApiOperation({
    summary: 'Direct and subtree counters for a folder',
    description:
      'One SQL query. direct* counts one level down and belongs in the details panel. subtree* and totalSize cover the whole branch and belong in the delete confirmation.',
  })
  @ApiOkResponse({ type: FolderStatsDto })
  @ApiNotFoundResponse({ description: 'Folder not found' })
  stats(@Param('id', ParseUUIDPipe) id: string): Promise<FolderStatsDto> {
    return this.foldersService.stats(id);
  }

  @Patch(':id')
  @ResourceTarget({ type: ShareResourceType.Folder, from: 'params', key: 'id' })
  @RequireRole(Role.Owner)
  @ApiOperation({ summary: 'Rename a folder' })
  @ApiOkResponse({ type: FolderDto })
  @ApiConflictResponse({ description: 'Name taken by a concurrent request' })
  @ApiNotFoundResponse({ description: 'Folder not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameFolderDto,
    @EffectiveRole() role: Role,
  ): Promise<FolderDto> {
    return this.foldersService.rename(id, dto, role);
  }

  @Post(':id/move')
  @ResourceTarget({ type: ShareResourceType.Folder, from: 'params', key: 'id' })
  @RequireRole(Role.Owner)
  @ApiOperation({
    summary: 'Move a folder',
    description:
      'Rejects cycles, rewrites the path of the whole subtree with a single UPDATE and re-checks depth after the move.',
  })
  @ApiOkResponse({ type: FolderDto })
  @ApiBadRequestResponse({ description: 'Cycle or depth limit exceeded' })
  @ApiNotFoundResponse({ description: 'Folder or target parent not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveFolderDto,
    @EffectiveRole() role: Role,
  ): Promise<FolderDto> {
    return this.foldersService.move(id, dto, role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResourceTarget({ type: ShareResourceType.Folder, from: 'params', key: 'id' })
  @RequireRole(Role.Owner)
  @ApiOperation({ summary: 'Soft delete a folder with its whole subtree' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Folder not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.foldersService.softDelete(id);
  }
}
