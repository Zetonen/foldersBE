import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GoogleOAuthService } from './google-oauth.service';

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const SECRET = 'x'.repeat(48);

const config = {
  GOOGLE_CLIENT_ID: CLIENT_ID,
  GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  JWT_ACCESS_SECRET: SECRET,
  FRONTEND_URL: 'http://localhost:3000',
} as Record<string, string | undefined>;

function makeService(overrides: Record<string, string | undefined> = {}): GoogleOAuthService {
  const values = { ...config, ...overrides };
  const configService = {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`missing ${key}`);
      }
      return value;
    },
  } as unknown as ConfigService;

  return new GoogleOAuthService(configService, new JwtService({}));
}

function idToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

  return `${encode({ alg: 'RS256' })}.${encode(claims)}.signature`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 600,
    sub: '109876543210987654321',
    email: 'anna@example.com',
    email_verified: true,
    name: 'Anna Kovalenko',
    ...overrides,
  };
}

function mockTokenResponse(body: unknown): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({ json: async () => body } as Response);
  global.fetch = fetchMock as unknown as typeof fetch;

  return fetchMock;
}

describe('GoogleOAuthService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('configuration', () => {
    it('reports itself unconfigured without a client id', () => {
      expect(makeService({ GOOGLE_CLIENT_ID: undefined }).isConfigured).toBe(false);
    });

    it('answers 503 instead of crashing when unconfigured', async () => {
      await expect(
        makeService({ GOOGLE_CLIENT_SECRET: undefined }).createAuthorizationUrl(),
      ).rejects.toMatchObject({ status: 503 });
    });

    it('derives the redirect uri from FRONTEND_URL when not set explicitly', async () => {
      const { url } = await makeService({
        GOOGLE_REDIRECT_URI: undefined,
        FRONTEND_URL: 'http://localhost:3000/',
      }).createAuthorizationUrl();

      expect(new URL(url).searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/auth/callback',
      );
    });

    it('uses only the first origin when FRONTEND_URL lists several for CORS', async () => {
      const { url } = await makeService({
        GOOGLE_REDIRECT_URI: undefined,
        FRONTEND_URL: 'http://localhost:3000, https://dataroom.example',
      }).createAuthorizationUrl();

      expect(new URL(url).searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/auth/callback',
      );
    });
  });

  describe('createAuthorizationUrl', () => {
    it('points at Google with the openid scopes and an embedded state', async () => {
      const { url, state } = await makeService().createAuthorizationUrl();
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(parsed.searchParams.get('client_id')).toBe(CLIENT_ID);
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('openid email profile');
      expect(parsed.searchParams.get('state')).toBe(state);
    });
  });

  describe('verifyState', () => {
    it('accepts the state it issued', async () => {
      const service = makeService();
      const { state } = await service.createAuthorizationUrl();

      await expect(service.verifyState(state)).resolves.toBeUndefined();
    });

    it('rejects a forged state', async () => {
      await expect(makeService().verifyState('forged.state.value')).rejects.toMatchObject({
        status: 401,
      });
    });

    it('rejects a state signed by another server', async () => {
      const foreign = await new JwtService({}).signAsync(
        { type: 'oauth_state', nonce: 'n' },
        { secret: 'y'.repeat(48), expiresIn: 600 },
      );

      await expect(makeService().verifyState(foreign)).rejects.toMatchObject({ status: 401 });
    });

    it('stays optional so the current frontend keeps working', async () => {
      await expect(makeService().verifyState(undefined)).resolves.toBeUndefined();
    });
  });

  describe('exchangeCode', () => {
    it('posts the code to Google and returns the profile', async () => {
      const fetchMock = mockTokenResponse({ id_token: idToken(validClaims()) });

      const profile = await makeService().exchangeCode('auth-code');

      expect(profile).toEqual({
        googleId: '109876543210987654321',
        email: 'anna@example.com',
        name: 'Anna Kovalenko',
      });

      const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = new URLSearchParams(init.body as string);
      expect(endpoint).toBe('https://oauth2.googleapis.com/token');
      expect(body.get('code')).toBe('auth-code');
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('redirect_uri')).toBe('http://localhost:3000/auth/callback');
    });

    it('rejects a code Google refused', async () => {
      mockTokenResponse({ error: 'invalid_grant' });

      await expect(makeService().exchangeCode('used-code')).rejects.toMatchObject({ status: 401 });
    });

    it('rejects a token minted for another application', async () => {
      mockTokenResponse({ id_token: idToken(validClaims({ aud: 'someone-else' })) });

      await expect(makeService().exchangeCode('code')).rejects.toMatchObject({ status: 401 });
    });

    it('rejects a token from an unexpected issuer', async () => {
      mockTokenResponse({ id_token: idToken(validClaims({ iss: 'https://evil.example' })) });

      await expect(makeService().exchangeCode('code')).rejects.toMatchObject({ status: 401 });
    });

    it('rejects an expired token', async () => {
      mockTokenResponse({
        id_token: idToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 10 })),
      });

      await expect(makeService().exchangeCode('code')).rejects.toMatchObject({ status: 401 });
    });

    it('rejects an unverified email so nobody can claim a foreign address', async () => {
      mockTokenResponse({ id_token: idToken(validClaims({ email_verified: false })) });

      await expect(makeService().exchangeCode('code')).rejects.toMatchObject({ status: 401 });
    });

    it('falls back to the email local part when Google sends no name', async () => {
      mockTokenResponse({
        id_token: idToken(validClaims({ name: undefined, given_name: undefined })),
      });

      await expect(makeService().exchangeCode('code')).resolves.toMatchObject({ name: 'anna' });
    });

    it('reports 503 when Google is unreachable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;

      await expect(makeService().exchangeCode('code')).rejects.toMatchObject({ status: 503 });
    });
  });
});
