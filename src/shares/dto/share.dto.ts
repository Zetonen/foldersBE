import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { Role } from '../../access/role.enum';
import { ShareKind, ShareResourceType, ShareRole } from '../enums/share.enums';

export class CreateShareDto {
  @ApiProperty({ enum: ShareResourceType })
  @IsEnum(ShareResourceType)
  resourceType!: ShareResourceType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  resourceId!: string;

  @ApiProperty({ enum: ShareKind })
  @IsEnum(ShareKind)
  kind!: ShareKind;

  @ApiPropertyOptional({ example: 'bob@example.com', description: 'Required for kind=USER' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(255)
  granteeEmail?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ListSharesQueryDto {
  @ApiProperty({ enum: ShareResourceType })
  @IsEnum(ShareResourceType)
  resourceType!: ShareResourceType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  resourceId!: string;
}

export class ShareDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ShareResourceType })
  resourceType!: ShareResourceType;

  @ApiProperty({ format: 'uuid' })
  resourceId!: string;

  @ApiProperty({ enum: ShareKind })
  kind!: ShareKind;

  @ApiProperty({ enum: ShareRole })
  role!: ShareRole;

  @ApiProperty({ nullable: true, example: 'bob@example.com' })
  granteeEmail!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  granteeUserId!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Public link token, present for kind=PUBLIC_LINK only',
  })
  token!: string | null;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class SharedWithMeItemDto {
  @ApiProperty({ enum: ShareResourceType })
  type!: ShareResourceType;

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Financials' })
  name!: string;

  @ApiProperty({ format: 'uuid', description: 'Data room owner — the person who shared this' })
  ownerId!: string;

  @ApiProperty({ example: 'Anna Kovalenko' })
  ownerName!: string;

  @ApiProperty({ example: 'anna@example.com' })
  ownerEmail!: string;

  @ApiProperty()
  sharedAt!: Date;

  @ApiProperty({ enum: Role })
  myRole!: Role;
}
