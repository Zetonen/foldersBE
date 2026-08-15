import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface RequestWithUser extends Request {
  user?: AuthUser;
}
