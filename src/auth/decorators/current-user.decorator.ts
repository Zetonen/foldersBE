import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthUser, RequestWithUser } from '../types/auth-user.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, context: ExecutionContext): AuthUser | string => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    return data ? request.user[data] : request.user;
  },
);
