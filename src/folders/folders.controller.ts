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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/types/auth-user.interface';
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
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a folder',
    description:
      'Builds the materialized path from the parent inside a transaction. Name collisions are resolved with a "(N)" suffix.',
  })
  @ApiOkResponse({ type: FolderDto })
  @ApiBadRequestResponse({ description: 'Nesting deeper than 20 levels' })
  @ApiNotFoundResponse({ description: 'Data room or parent folder not found' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFolderDto): Promise<FolderDto> {
    return this.foldersService.create(user.id, dto);
  }

  @Get(':id/children')
  @ApiOperation({
    summary: 'List folders and files inside a folder',
    description: 'Keyset pagination over (name, id). Pass nextCursor back as ?cursor=.',
  })
  @ApiOkResponse({ type: FolderContentsDto })
  @ApiNotFoundResponse({ description: 'Folder not found' })
  children(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListChildrenQueryDto,
  ): Promise<FolderContentsDto> {
    return this.foldersService.listChildren(user.id, id, query);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Subtree totals, used to warn before deletion',
    description: 'Single SQL query over the subtree selected by path LIKE.',
  })
  @ApiOkResponse({ type: FolderStatsDto })
  @ApiNotFoundResponse({ description: 'Folder not found' })
  stats(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FolderStatsDto> {
    return this.foldersService.stats(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a folder' })
  @ApiOkResponse({ type: FolderDto })
  @ApiConflictResponse({ description: 'Name taken by a concurrent request' })
  @ApiNotFoundResponse({ description: 'Folder not found' })
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameFolderDto,
  ): Promise<FolderDto> {
    return this.foldersService.rename(user.id, id, dto);
  }

  @Post(':id/move')
  @ApiOperation({
    summary: 'Move a folder',
    description:
      'Rejects cycles, rewrites the path of the whole subtree with a single UPDATE and re-checks depth after the move.',
  })
  @ApiOkResponse({ type: FolderDto })
  @ApiBadRequestResponse({ description: 'Cycle or depth limit exceeded' })
  @ApiNotFoundResponse({ description: 'Folder or target parent not found' })
  move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveFolderDto,
  ): Promise<FolderDto> {
    return this.foldersService.move(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a folder with its whole subtree' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Folder not found' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.foldersService.softDelete(user.id, id);
  }
}
