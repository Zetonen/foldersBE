import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { AccessDecision } from '../access.types';
import { Role } from '../role.enum';

interface RequestWithAccess {
  access?: AccessDecision;
}

function read(context: ExecutionContext): AccessDecision {
  const request = context.switchToHttp().getRequest<RequestWithAccess>();

  if (!request.access) {
    throw new InternalServerErrorException('ResourceAccessGuard did not run for this route');
  }

  return request.access;
}

export const EffectiveRole = createParamDecorator(
  (_: unknown, context: ExecutionContext): Role => read(context).role,
);

export const AccessContext = createParamDecorator(
  (_: unknown, context: ExecutionContext): AccessDecision => read(context),
);
