import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { GoogleOAuthService, GoogleProfile } from './google/google-oauth.service';

const SECRET = 'x'.repeat(48);

const PROFILE: GoogleProfile = {
  googleId: '109876543210987654321',
  email: 'anna@example.com',
  name: 'Anna Kovalenko',
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'anna@example.com',
    passwordHash: '$2b$10$hash',
    googleId: null,
    name: 'Anna Kovalenko',
    createdAt: new Date('2026-08-16T10:00:00.000Z'),
    ...overrides,
  };
}

interface Stubs {
  users: jest.Mocked<
    Pick<
      UsersService,
      'findByEmail' | 'findByGoogleId' | 'findById' | 'linkGoogleId' | 'createFromGoogle'
    >
  >;
  google: jest.Mocked<Pick<GoogleOAuthService, 'verifyState' | 'exchangeCode'>>;
  service: AuthService;
}

function setup(): Stubs {
  const users = {
    findByEmail: jest.fn(),
    findByGoogleId: jest.fn(),
    findById: jest.fn(),
    linkGoogleId: jest.fn(),
    createFromGoogle: jest.fn(),
  } as unknown as Stubs['users'];

  const google = {
    verifyState: jest.fn().mockResolvedValue(undefined),
    exchangeCode: jest.fn().mockResolvedValue(PROFILE),
  } as unknown as Stubs['google'];

  const config = {
    get: (key: string) => ({ JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' })[key],
    getOrThrow: () => SECRET,
  } as unknown as ConfigService;

  const service = new AuthService(
    users as unknown as UsersService,
    new JwtService({}),
    config,
    google as unknown as GoogleOAuthService,
  );

  return { users, google, service };
}

describe('AuthService — Google sign-in', () => {
  it('creates a user on first sign-in', async () => {
    const { users, service } = setup();
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    users.createFromGoogle.mockResolvedValue(
      makeUser({ passwordHash: null, googleId: PROFILE.googleId }),
    );

    const result = await service.loginWithGoogle({ code: 'code' });

    expect(users.createFromGoogle).toHaveBeenCalledWith(PROFILE);
    expect(result.user.email).toBe('anna@example.com');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.expiresIn).toBe(900);
  });

  it('reuses the account already linked to that Google id', async () => {
    const { users, service } = setup();
    const linked = makeUser({ id: 'user-9', googleId: PROFILE.googleId, passwordHash: null });
    users.findByGoogleId.mockResolvedValue(linked);

    const result = await service.loginWithGoogle({ code: 'code' });

    expect(result.user.id).toBe('user-9');
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(users.createFromGoogle).not.toHaveBeenCalled();
  });

  it('links Google to an existing password account with the same verified email', async () => {
    const { users, service } = setup();
    const existing = makeUser({ id: 'user-2' });
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(existing);
    users.linkGoogleId.mockResolvedValue({ ...existing, googleId: PROFILE.googleId });

    const result = await service.loginWithGoogle({ code: 'code' });

    expect(users.linkGoogleId).toHaveBeenCalledWith('user-2', PROFILE.googleId);
    expect(users.createFromGoogle).not.toHaveBeenCalled();
    expect(result.user.id).toBe('user-2');
  });

  it('verifies the state before spending the authorization code', async () => {
    const { google, users, service } = setup();
    google.verifyState.mockRejectedValue(Object.assign(new Error('bad state'), { status: 401 }));

    await expect(service.loginWithGoogle({ code: 'code', state: 'forged' })).rejects.toThrow();
    expect(google.exchangeCode).not.toHaveBeenCalled();
    expect(users.createFromGoogle).not.toHaveBeenCalled();
  });

  it('refuses a password login for a Google-only account', async () => {
    const { users, service } = setup();
    users.findByEmail.mockResolvedValue(makeUser({ passwordHash: null, googleId: 'g' }));

    await expect(
      service.login({ email: 'anna@example.com', password: 'whatever' }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
