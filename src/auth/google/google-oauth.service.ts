import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const STATE_TTL_SECONDS = 600;
const TOKEN_EXCHANGE_TIMEOUT_MS = 10_000;

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

interface GoogleTokenResponse {
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleIdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
}

interface StatePayload {
  type: 'oauth_state';
  nonce: string;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  get isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('GOOGLE_CLIENT_ID') &&
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
    );
  }

  async createAuthorizationUrl(): Promise<{ url: string; state: string }> {
    this.assertConfigured();

    const state = await this.jwtService.signAsync(
      { type: 'oauth_state', nonce: randomUUID() } satisfies StatePayload,
      { secret: this.stateSecret, expiresIn: STATE_TTL_SECONDS },
    );

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      include_granted_scopes: 'true',
      state,
    });

    return { url: `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`, state };
  }

  async verifyState(state: string | undefined): Promise<void> {
    if (state === undefined) {
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<StatePayload>(state, {
        secret: this.stateSecret,
      });

      if (payload.type !== 'oauth_state') {
        throw new Error('wrong token type');
      }
    } catch {
      throw new UnauthorizedException('OAuth state is invalid or expired');
    }
  }

  async exchangeCode(code: string): Promise<GoogleProfile> {
    this.assertConfigured();

    const payload = await this.requestTokens(code);

    if (payload.error || !payload.id_token) {
      this.logger.warn(`Google token exchange failed: ${payload.error ?? 'no id_token'}`);
      throw new UnauthorizedException('Google authorization code is invalid or already used');
    }

    return this.profileFromIdToken(payload.id_token);
  }

  private async requestTokens(code: string): Promise<GoogleTokenResponse> {
    let response: Response;

    try {
      response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(TOKEN_EXCHANGE_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`Google token endpoint unreachable: ${String(error)}`);
      throw new ServiceUnavailableException('Google sign-in is temporarily unavailable');
    }

    try {
      return (await response.json()) as GoogleTokenResponse;
    } catch {
      throw new ServiceUnavailableException('Google sign-in is temporarily unavailable');
    }
  }

  private profileFromIdToken(idToken: string): GoogleProfile {
    const claims = this.decodeIdToken(idToken);
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

    if (!claims.sub || !claims.email) {
      throw new UnauthorizedException('Google did not return an email for this account');
    }

    if (!GOOGLE_ISSUERS.includes(claims.iss ?? '') || claims.aud !== this.clientId) {
      throw new UnauthorizedException('Google identity token was issued for another application');
    }

    if (!claims.exp || claims.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('Google identity token is expired');
    }

    if (!emailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    return {
      googleId: claims.sub,
      email: claims.email,
      name: (claims.name ?? claims.given_name ?? claims.email.split('@')[0]).trim(),
    };
  }

  private decodeIdToken(idToken: string): GoogleIdTokenClaims {
    const segments = idToken.split('.');

    if (segments.length !== 3) {
      throw new UnauthorizedException('Google identity token is malformed');
    }

    try {
      return JSON.parse(
        Buffer.from(segments[1], 'base64url').toString('utf8'),
      ) as GoogleIdTokenClaims;
    } catch {
      throw new UnauthorizedException('Google identity token is malformed');
    }
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Google sign-in is not configured on this server');
    }
  }

  private get clientId(): string {
    return this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
  }

  private get stateSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private get redirectUri(): string {
    const configured = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    if (configured) {
      return configured;
    }

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL').split(',')[0].trim();

    return `${frontendUrl.replace(/\/+$/, '')}/auth/callback`;
  }
}
