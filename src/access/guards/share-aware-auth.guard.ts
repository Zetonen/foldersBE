import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { JwtPayload, RequestWithUser } from '../../auth/types/auth-user.interface';

@Injectable()
export class ShareAwareAuthGuard implements CanActivate {
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
    const header = request.headers.authorization;
    const shareToken = request.headers['x-share-token'];

    if (!header) {
      if (typeof shareToken === 'string' && shareToken.length > 0) {
        return true;
      }

      throw new UnauthorizedException('Access token or X-Share-Token is required');
    }

    const [scheme, value] = header.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(value, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Access token is invalid or expired');
      }

      request.user = { id: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    return true;
  }
}
