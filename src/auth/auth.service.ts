import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { BCRYPT_COST, parseDurationToSeconds } from './auth.constants';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserDto } from './dto/user.dto';
import { GoogleAuthUrlDto } from './dto/google-auth-url.dto';
import { GoogleCallbackDto } from './dto/google-callback.dto';
import { GoogleOAuthService, GoogleProfile } from './google/google-oauth.service';
import { JwtPayload } from './types/auth-user.interface';

const DUMMY_HASH = '$2b$10$3S6yQ2X5rN0k7fP8bC1uQeJb0mZ5t3fXn6oH4vK9wR2sT1uV0xY6a';

export interface AuthResult extends AuthResponseDto {
  refreshToken: string;
  refreshExpiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    const matches = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);

    if (user && !user.passwordHash) {
      throw new UnauthorizedException('This account uses Google sign-in');
    }

    if (!user || !matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user);
  }

  googleAuthorizationUrl(): Promise<GoogleAuthUrlDto> {
    return this.googleOAuthService.createAuthorizationUrl();
  }

  async loginWithGoogle(dto: GoogleCallbackDto): Promise<AuthResult> {
    await this.googleOAuthService.verifyState(dto.state);

    const profile = await this.googleOAuthService.exchangeCode(dto.code);

    return this.issueTokens(await this.resolveGoogleUser(profile));
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    return this.issueTokens(user);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return UserDto.fromEntity(user);
  }

  private async resolveGoogleUser(profile: GoogleProfile): Promise<User> {
    const linked = await this.usersService.findByGoogleId(profile.googleId);

    if (linked) {
      return linked;
    }

    const byEmail = await this.usersService.findByEmail(profile.email);

    if (byEmail) {
      return this.usersService.linkGoogleId(byEmail.id, profile.googleId);
    }

    return this.usersService.createFromGoogle({
      email: profile.email,
      name: profile.name,
      googleId: profile.googleId,
    });
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const accessTtl = parseDurationToSeconds(
      this.configService.get<string>('JWT_ACCESS_TTL') ?? '15m',
    );
    const refreshTtl = parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_TTL') ?? '7d',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, email: user.email, type: 'access' } satisfies JwtPayload,
        {
          secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: accessTtl,
        },
      ),
      this.jwtService.signAsync(
        { sub: user.id, email: user.email, type: 'refresh' } satisfies JwtPayload,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: refreshTtl,
        },
      ),
    ]);

    return {
      accessToken,
      expiresIn: accessTtl,
      refreshToken,
      refreshExpiresIn: refreshTtl,
      user: UserDto.fromEntity(user),
    };
  }
}
