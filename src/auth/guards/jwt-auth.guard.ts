import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload, RequestWithUser } from '../types/auth-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Access token is missing');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    request.user = { id: payload.sub, email: payload.email };

    return true;
  }

  private extractToken(request: RequestWithUser): string | null {
    const header = request.headers.authorization;

    if (!header) {
      return null;
    }

    const [scheme, value] = header.split(' ');

    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
