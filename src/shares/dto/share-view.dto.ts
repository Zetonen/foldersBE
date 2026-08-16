import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../access/role.enum';
import { FileDto } from '../../files/dto/file.dto';
import { BreadcrumbDto, FolderDto, FolderItemDto } from '../../folders/dto/folder.dto';
import { ShareResourceType } from '../enums/share.enums';

export class ShareViewDto {
  @ApiProperty({ enum: ShareResourceType })
  resourceType!: ShareResourceType;

  @ApiProperty({
    type: () => Object,
    nullable: true,
    description: 'Only present when the share covers the whole data room',
  })
  dataRoom!: { id: string; name: string } | null;

  @ApiProperty({ type: FolderDto, nullable: true })
  folder!: FolderDto | null;

  @ApiProperty({ type: FileDto, nullable: true })
  file!: FileDto | null;

  @ApiProperty({
    type: [BreadcrumbDto],
    description: 'Starts at the share root, never above it',
  })
  breadcrumbs!: BreadcrumbDto[];

  @ApiProperty({ type: [FolderItemDto] })
  items!: FolderItemDto[];

  @ApiProperty({
    nullable: true,
    description: 'Pass back as ?cursor= to fetch the next page. null means this was the last page.',
  })
  nextCursor!: string | null;

  @ApiProperty({
    example: 137,
    description: 'Direct children of the folder being listed, 0 for a file share.',
  })
  totalItems!: number;

  @ApiProperty({ format: 'uuid', description: 'Data room owner, the person who shared this' })
  ownerId!: string;

  @ApiProperty({
    example: 'Anna Kovalenko',
    description: 'Name only. The owner email is never exposed to an anonymous link visitor.',
  })
  ownerName!: string;

  @ApiProperty({ enum: Role })
  myRole!: Role;
}
