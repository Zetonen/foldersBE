import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  NAME_MAX_LENGTH,
  NAME_PATTERN,
  NAME_PATTERN_MESSAGE,
} from '../../common/validation/name.rules';
import { Role } from '../../access/role.enum';
import { Folder } from '../entities/folder.entity';

export class CreateFolderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  dataRoomId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'null creates the folder in the data room root',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @ApiProperty({ example: 'Financials', maxLength: NAME_MAX_LENGTH })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;
}

export class RenameFolderDto {
  @ApiProperty({ example: 'Financials 2026', maxLength: NAME_MAX_LENGTH })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;
}

export class MoveFolderDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Target parent folder, null moves to the data room root',
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId!: string | null;
}

export class ListChildrenQueryDto {
  @ApiPropertyOptional({ description: 'Opaque cursor returned as nextCursor' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class FolderDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  dataRoomId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  parentId!: string | null;

  @ApiProperty({ example: 'Financials' })
  name!: string;

  @ApiProperty({ example: '/3f4a…/9b0e…/' })
  path!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ enum: Role, description: 'Effective role of the caller on this folder' })
  myRole!: Role;

  static fromEntity(folder: Folder, myRole: Role): FolderDto {
    return {
      id: folder.id,
      dataRoomId: folder.dataRoomId,
      parentId: folder.parentId,
      name: folder.name,
      path: folder.path,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      myRole,
    };
  }
}

export class BreadcrumbDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026' })
  name!: string;
}

export class FolderItemDto {
  @ApiProperty({ enum: ['FOLDER', 'FILE'] })
  type!: 'FOLDER' | 'FILE';

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'audit.pdf' })
  name!: string;

  @ApiProperty({ nullable: true, description: 'Files only', example: 1048576 })
  sizeBytes!: number | null;

  @ApiProperty({ nullable: true, description: 'Files only', example: 'application/pdf' })
  mimeType!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class FolderContentsDto {
  @ApiProperty({
    type: () => Object,
    nullable: true,
    description: 'null when the caller reached this listing through a share below the room root',
  })
  dataRoom!: { id: string; name: string } | null;

  @ApiProperty({ type: FolderDto, nullable: true, description: 'null for the data room root' })
  folder!: FolderDto | null;

  @ApiProperty({
    type: [BreadcrumbDto],
    description: 'Ancestors, closest to the root first. Trimmed at the share root for recipients.',
  })
  breadcrumbs!: BreadcrumbDto[];

  @ApiProperty({ type: [FolderItemDto] })
  items!: FolderItemDto[];

  @ApiProperty({ nullable: true, description: 'Pass back as ?cursor= to fetch the next page' })
  nextCursor!: string | null;

  @ApiProperty({ enum: Role, description: 'Effective role of the caller, items inherit it' })
  myRole!: Role;
}

export class FolderStatsDto {
  @ApiProperty({ example: 5242880, description: 'Sum of size_bytes across the whole subtree' })
  totalSize!: number;

  @ApiProperty({ example: 12 })
  fileCount!: number;

  @ApiProperty({ example: 3, description: 'Descendant folders, the folder itself excluded' })
  folderCount!: number;
}
