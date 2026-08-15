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
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { EffectiveRole } from '../access/decorators/effective-role.decorator';
import { RequireRole, ResourceTarget } from '../access/decorators/resource-target.decorator';
import { ResourceAccessGuard } from '../access/guards/resource-access.guard';
import { ShareAwareAuthGuard } from '../access/guards/share-aware-auth.guard';
import { Role } from '../access/role.enum';
import { ShareResourceType } from '../shares/enums/share.enums';
import {
  ConfirmUploadDto,
  CreateUploadUrlDto,
  DownloadUrlDto,
  FileDto,
  MoveFileDto,
  RenameFileDto,
  UploadUrlDto,
} from './dto/file.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth('access-token')
@ApiHeader({ name: 'X-Share-Token', required: false, description: 'Public share token' })
@UseGuards(ShareAwareAuthGuard, ResourceAccessGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  @ResourceTarget({ type: ShareResourceType.DataRoom, from: 'body', key: 'dataRoomId' })
  @RequireRole(Role.Owner)
  @ApiOperation({
    summary: 'Get a signed upload URL',
    description:
      'Resolves the name conflict and returns the URL to PUT the bytes to. No database row is created yet.',
  })
  @ApiOkResponse({ type: UploadUrlDto })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds FILE_MAX_SIZE_BYTES' })
  @ApiUnsupportedMediaTypeResponse({ description: 'MIME type not in FILE_ALLOWED_MIME_TYPES' })
  @ApiNotFoundResponse({ description: 'Data room or folder not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  uploadUrl(@Body() dto: CreateUploadUrlDto): Promise<UploadUrlDto> {
    return this.filesService.createUploadUrl(dto);
  }

  @Post('confirm')
  @ResourceTarget({ type: ShareResourceType.DataRoom, from: 'body', key: 'dataRoomId' })
  @RequireRole(Role.Owner)
  @ApiOperation({
    summary: 'Register an uploaded object',
    description: 'Verifies the object exists in storage, then creates the row in files.',
  })
  @ApiOkResponse({ type: FileDto })
  @ApiBadRequestResponse({ description: 'Object missing, size mismatch or foreign storageKey' })
  @ApiConflictResponse({ description: 'Object already registered' })
  confirm(@Body() dto: ConfirmUploadDto, @EffectiveRole() role: Role): Promise<FileDto> {
    return this.filesService.confirm(dto, role);
  }

  @Get(':id')
  @ResourceTarget({ type: ShareResourceType.File, from: 'params', key: 'id' })
  @RequireRole(Role.Viewer)
  @ApiOperation({ summary: 'File metadata' })
  @ApiOkResponse({ type: FileDto })
  @ApiNotFoundResponse({ description: 'File not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @EffectiveRole() role: Role): Promise<FileDto> {
    return this.filesService.findOne(id, role);
  }

  @Get(':id/download-url')
  @ResourceTarget({ type: ShareResourceType.File, from: 'params', key: 'id' })
  @RequireRole(Role.Viewer)
  @ApiOperation({
    summary: 'Signed download URL',
    description: 'Generated on demand, TTL from FILE_DOWNLOAD_URL_TTL_SECONDS (15 minutes).',
  })
  @ApiOkResponse({ type: DownloadUrlDto })
  @ApiNotFoundResponse({ description: 'File not found' })
  downloadUrl(@Param('id', ParseUUIDPipe) id: string): Promise<DownloadUrlDto> {
    return this.filesService.createDownloadUrl(id);
  }

  @Patch(':id')
  @ResourceTarget({ type: ShareResourceType.File, from: 'params', key: 'id' })
  @RequireRole(Role.Owner)
  @ApiOperation({ summary: 'Rename a file' })
  @ApiOkResponse({ type: FileDto })
  @ApiNotFoundResponse({ description: 'File not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameFileDto,
    @EffectiveRole() role: Role,
  ): Promise<FileDto> {
    return this.filesService.rename(id, dto, role);
  }

  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  @ResourceTarget({ type: ShareResourceType.File, from: 'params', key: 'id' })
  @RequireRole(Role.Owner)
  @ApiOperation({ summary: 'Move a file to another folder' })
  @ApiOkResponse({ type: FileDto })
  @ApiNotFoundResponse({ description: 'File or target folder not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveFileDto,
    @EffectiveRole() role: Role,
  ): Promise<FileDto> {
    return this.filesService.move(id, dto, role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResourceTarget({ type: ShareResourceType.File, from: 'params', key: 'id' })
  @RequireRole(Role.Owner)
  @ApiOperation({
    summary: 'Soft delete a file',
    description: 'Marks the row deleted, then removes the object from storage after the commit.',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'File not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.filesService.softDelete(id);
  }
}
