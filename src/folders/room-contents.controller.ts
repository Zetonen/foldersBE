import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/types/auth-user.interface';
import { FolderContentsDto, ListChildrenQueryDto } from './dto/folder.dto';
import { FoldersService } from './folders.service';

@ApiTags('folders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('data-rooms')
export class RoomContentsController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get(':id/root')
  @ApiOperation({
    summary: 'List folders and files in the data room root',
    description: 'Same shape as /folders/:id/children, with folder = null and empty breadcrumbs.',
  })
  @ApiOkResponse({ type: FolderContentsDto })
  @ApiNotFoundResponse({ description: 'Data room not found' })
  root(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListChildrenQueryDto,
  ): Promise<FolderContentsDto> {
    return this.foldersService.listRoot(user.id, id, query);
  }
}
