import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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
import { FileEntity } from '../entities/file.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateUploadUrlDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  dataRoomId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'null uploads to the room root' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  folderId?: string | null;

  @ApiProperty({ example: 'audit.pdf', maxLength: NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  fileName!: string;

  @ApiProperty({ example: 1048576, description: 'Bytes, checked against FILE_MAX_SIZE_BYTES' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @ApiProperty({ example: 'application/pdf' })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  mimeType!: string;
}

export class ConfirmUploadDto {
  @ApiProperty({
    example: '3f4a1c9e-…/9b0e2f5b-…',
    description: 'Returned by /files/upload-url, must live under {dataRoomId}/',
  })
  @IsString()
  @MaxLength(512)
  storageKey!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  dataRoomId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'null is the room root' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  folderId?: string | null;

  @ApiProperty({ example: 'audit.pdf', description: 'Final name returned by /files/upload-url' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;

  @ApiProperty({ example: 1048576 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @ApiProperty({ example: 'application/pdf' })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  mimeType!: string;
}

export class RenameFileDto {
  @ApiProperty({ example: 'audit-2026.pdf', maxLength: NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;
}

export class MoveFileDto {
  @ApiProperty({ format: 'uuid', nullable: true, description: 'null moves to the room root' })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  folderId!: string | null;
}

export class FileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  dataRoomId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  folderId!: string | null;

  @ApiProperty({ example: 'audit.pdf' })
  name!: string;

  @ApiProperty({ example: 1048576 })
  sizeBytes!: number;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ enum: Role, description: 'Effective role of the caller on this file' })
  myRole!: Role;

  static fromEntity(file: FileEntity, myRole: Role): FileDto {
    return {
      id: file.id,
      dataRoomId: file.dataRoomId,
      folderId: file.folderId,
      name: file.name,
      sizeBytes: file.sizeBytes,
      mimeType: file.mimeType,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      myRole,
    };
  }
}

export class UploadUrlDto {
  @ApiProperty({ description: 'PUT the bytes here, no auth header needed' })
  uploadUrl!: string;

  @ApiProperty({ description: 'Token for supabase-js uploadToSignedUrl()' })
  token!: string;

  @ApiProperty({ example: '3f4a1c9e-…/9b0e2f5b-…' })
  storageKey!: string;

  @ApiProperty({
    example: 'audit (1).pdf',
    description: 'Name after conflict resolution, pass it back to /files/confirm',
  })
  name!: string;
}

export class DownloadUrlDto {
  @ApiProperty({
    example: 'https://<project>.supabase.co/storage/v1/object/sign/dataroom-files/…?token=…',
    description: 'Signed URL, valid for expiresIn seconds',
  })
  url!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}
