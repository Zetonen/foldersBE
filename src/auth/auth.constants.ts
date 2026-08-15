import { CookieOptions } from 'express';

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/auth';
export const BCRYPT_COST = 10;

export function refreshCookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeSeconds * 1000,
  };
}

export function clearedRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: REFRESH_COOKIE_PATH,
  };
}

export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

  return amount * (match[2] ? multipliers[match[2]] : 1);
}
