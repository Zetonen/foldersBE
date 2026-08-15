import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { CreateShareDto, ListSharesQueryDto, ShareDto } from './dto/share.dto';
import { SharesService } from './shares.service';

@ApiTags('shares')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ResourceAccessGuard)
@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  @ResourceTarget({ typeFrom: 'body', typeKey: 'resourceType', from: 'body', key: 'resourceId' })
  @RequireRole(Role.Owner)
  @ApiOperation({
    summary: 'Share a resource',
    description:
      'For PUBLIC_LINK returns the existing active link if there is one, instead of issuing a second token.',
  })
  @ApiOkResponse({ type: ShareDto })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  @ApiForbiddenResponse({ description: 'Only the owner can share' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateShareDto): Promise<ShareDto> {
    return this.sharesService.create(user, dto);
  }

  @Get()
  @ResourceTarget({ typeFrom: 'query', typeKey: 'resourceType', from: 'query', key: 'resourceId' })
  @RequireRole(Role.Owner)
  @ApiOperation({ summary: 'Who has access to a resource' })
  @ApiOkResponse({ type: [ShareDto] })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  list(@Query() query: ListSharesQueryDto): Promise<ShareDto[]> {
    return this.sharesService.listForResource(query.resourceType, query.resourceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a share', description: 'Sets revoked_at, never deletes the row.' })
  @ApiNoContentResponse({ description: 'Revoked' })
  @ApiNotFoundResponse({ description: 'Share not found' })
  @ApiForbiddenResponse({ description: 'Only the owner can revoke a share' })
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.sharesService.revoke(user, id);
  }
}
