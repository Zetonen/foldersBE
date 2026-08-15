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
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequireRole, ResourceTarget } from '../access/decorators/resource-target.decorator';
import { ResourceAccessGuard } from '../access/guards/resource-access.guard';
import { Role } from '../access/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/types/auth-user.interface';
import { ShareResourceType } from '../shares/enums/share.enums';
import { DataRoomsService } from './data-rooms.service';
import { CreateDataRoomDto, DataRoomDto, RenameDataRoomDto } from './dto/data-room.dto';

@ApiTags('data-rooms')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ResourceAccessGuard)
@Controller('data-rooms')
export class DataRoomsController {
  constructor(private readonly dataRoomsService: DataRoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a data room' })
  @ApiOkResponse({ type: DataRoomDto })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDataRoomDto,
  ): Promise<DataRoomDto> {
    return DataRoomDto.fromEntity(await this.dataRoomsService.create(user.id, dto));
  }

  @Get()
  @ApiOperation({ summary: 'List data rooms owned by the current user' })
  @ApiOkResponse({ type: [DataRoomDto] })
  async findMine(@CurrentUser() user: AuthUser): Promise<DataRoomDto[]> {
    const rooms = await this.dataRoomsService.findMine(user.id);

    return rooms.map(DataRoomDto.fromEntity);
  }

  @Patch(':id')
  @ResourceTarget({ type: ShareResourceType.DataRoom, from: 'params', key: 'id' })
  @RequireRole(Role.Owner)
  @ApiOperation({ summary: 'Rename a data room' })
  @ApiOkResponse({ type: DataRoomDto })
  @ApiNotFoundResponse({ description: 'Data room not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  async rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameDataRoomDto,
  ): Promise<DataRoomDto> {
    return DataRoomDto.fromEntity(await this.dataRoomsService.rename(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResourceTarget({ type: ShareResourceType.DataRoom, from: 'params', key: 'id' })
  @RequireRole(Role.Owner)
  @ApiOperation({ summary: 'Soft delete a data room with every folder and file inside it' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Data room not found' })
  @ApiForbiddenResponse({ description: 'Role too low for this action' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.dataRoomsService.softDelete(id);
  }
}
