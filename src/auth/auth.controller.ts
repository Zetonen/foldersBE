import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
  clearedRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from './auth.constants';
import { AuthResult, AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { RegisterDto } from './dto/register.dto';
import { UserDto } from './dto/user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthUser } from './types/auth-user.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates the user, returns an access token in the body and sets the refresh token cookie.',
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email is already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.respondWithTokens(await this.authService.register(dto), response);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in',
    description:
      'Returns an access token (15 min) in the body and sets an httpOnly refresh cookie (7 days, path=/auth).',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.respondWithTokens(await this.authService.login(dto), response);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({
    summary: 'Exchange the refresh cookie for a new access token',
    description: 'Reads the refresh token from the httpOnly cookie and rotates both tokens.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token is missing, invalid or expired' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const token = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

    return this.respondWithTokens(await this.authService.refresh(token), response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out', description: 'Clears the refresh cookie.' })
  @ApiOkResponse({ type: MessageResponseDto })
  logout(@Res({ passthrough: true }) response: Response): MessageResponseDto {
    response.clearCookie(REFRESH_COOKIE_NAME, clearedRefreshCookieOptions());

    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current user' })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({ description: 'Access token is missing, invalid or expired' })
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.authService.me(user.id);
  }

  private respondWithTokens(result: AuthResult, response: Response): AuthResponseDto {
    response.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      refreshCookieOptions(result.refreshExpiresIn),
    );

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }
}
