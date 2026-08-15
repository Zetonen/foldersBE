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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/types/auth-user.interface';
import { DataRoomsService } from './data-rooms.service';
import { CreateDataRoomDto, DataRoomDto, RenameDataRoomDto } from './dto/data-room.dto';

@ApiTags('data-rooms')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
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
  @ApiOperation({ summary: 'Rename a data room' })
  @ApiOkResponse({ type: DataRoomDto })
  @ApiNotFoundResponse({ description: 'Data room not found' })
  async rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameDataRoomDto,
  ): Promise<DataRoomDto> {
    return DataRoomDto.fromEntity(await this.dataRoomsService.rename(user.id, id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft delete a data room with every folder and file inside it',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Data room not found' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.dataRoomsService.softDelete(user.id, id);
  }
}
