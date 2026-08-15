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

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '/3f4a…/9b0e…/' })
  path!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(folder: Folder): FolderDto {
    return {
      id: folder.id,
      dataRoomId: folder.dataRoomId,
      parentId: folder.parentId,
      name: folder.name,
      path: folder.path,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }
}

export class BreadcrumbDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class FolderItemDto {
  @ApiProperty({ enum: ['FOLDER', 'FILE'] })
  type!: 'FOLDER' | 'FILE';

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
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
  @ApiProperty({ type: () => Object, description: 'The data room the listing belongs to' })
  dataRoom!: { id: string; name: string };

  @ApiProperty({ type: FolderDto, nullable: true, description: 'null for the data room root' })
  folder!: FolderDto | null;

  @ApiProperty({ type: [BreadcrumbDto], description: 'Ancestors, closest to the root first' })
  breadcrumbs!: BreadcrumbDto[];

  @ApiProperty({ type: [FolderItemDto] })
  items!: FolderItemDto[];

  @ApiProperty({ nullable: true, description: 'Pass back as ?cursor= to fetch the next page' })
  nextCursor!: string | null;
}

export class FolderStatsDto {
  @ApiProperty({ example: 5242880, description: 'Sum of size_bytes across the whole subtree' })
  totalSize!: number;

  @ApiProperty({ example: 12 })
  fileCount!: number;

  @ApiProperty({ example: 3, description: 'Descendant folders, the folder itself excluded' })
  folderCount!: number;
}
