import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/types/auth-user.interface';
import { SharedWithMeItemDto } from './dto/share.dto';
import { SharesService } from './shares.service';

@ApiTags('shares')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('shared-with-me')
export class SharedWithMeController {
  constructor(private readonly sharesService: SharesService) {}

  @Get()
  @ApiOperation({
    summary: 'Flat list of share roots granted to the current user',
    description:
      'Nested shares are collapsed: a root is hidden when another of your roots is its ancestor.',
  })
  @ApiOkResponse({ type: [SharedWithMeItemDto] })
  sharedWithMe(@CurrentUser() user: AuthUser): Promise<SharedWithMeItemDto[]> {
    return this.sharesService.sharedWithMe(user);
  }
}
