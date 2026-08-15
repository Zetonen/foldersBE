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

  @ApiProperty({ nullable: true, description: 'Pass back as ?cursor= to fetch the next page' })
  nextCursor!: string | null;

  @ApiProperty({ enum: Role })
  myRole!: Role;
}
