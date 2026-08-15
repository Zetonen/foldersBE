import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser } from '../../auth/types/auth-user.interface';
import { ShareResourceType } from '../../shares/enums/share.enums';
import { AccessResolverService } from '../access-resolver.service';
import { AccessDecision } from '../access.types';
import {
  REQUIRE_ROLE_KEY,
  RESOURCE_TARGET_KEY,
  ResourceTargetMeta,
  TargetSource,
} from '../decorators/resource-target.decorator';
import { Role, satisfies } from '../role.enum';

const NOT_FOUND_MESSAGE: Record<ShareResourceType, string> = {
  [ShareResourceType.DataRoom]: 'Data room not found',
  [ShareResourceType.Folder]: 'Folder not found',
  [ShareResourceType.File]: 'File not found',
};

interface GuardedRequest extends Request {
  user?: AuthUser;
  access?: AccessDecision;
}

@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(
    private readonly resolver: AccessResolverService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const target = this.reflector.getAllAndOverride<ResourceTargetMeta | undefined>(
      RESOURCE_TARGET_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!target) {
      return true;
    }

    const required =
      this.reflector.getAllAndOverride<Role | undefined>(REQUIRE_ROLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? Role.Viewer;

    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const resourceType = this.readResourceType(request, target);
    const resourceId = this.readValue(request, target.from, target.key);

    if (!resourceId) {
      throw new BadRequestException(`${target.key} is required`);
    }

    const decision = await this.resolver.resolve({
      actor: request.user ?? null,
      token: this.readToken(request),
      resourceType,
      resourceId,
    });

    if (!decision) {
      throw new NotFoundException(NOT_FOUND_MESSAGE[resourceType]);
    }

    if (!satisfies(decision.role, required)) {
      throw new ForbiddenException('Your role does not allow this action');
    }

    request.access = decision;

    return true;
  }

  private readResourceType(request: GuardedRequest, target: ResourceTargetMeta): ShareResourceType {
    if (target.type) {
      return target.type;
    }

    const raw = this.readValue(request, target.typeFrom ?? 'body', target.typeKey ?? 'resourceType');

    if (!raw || !Object.values(ShareResourceType).includes(raw as ShareResourceType)) {
      throw new BadRequestException('resourceType is invalid');
    }

    return raw as ShareResourceType;
  }

  private readValue(request: GuardedRequest, from: TargetSource, key: string): string | null {
    const container =
      from === 'params' ? request.params : from === 'query' ? request.query : request.body;
    const value = (container as Record<string, unknown> | undefined)?.[key];

    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private readToken(request: GuardedRequest): string | null {
    const header = request.headers['x-share-token'];

    if (typeof header === 'string' && header.length > 0) {
      return header;
    }

    const param = request.params?.token;

    return typeof param === 'string' && param.length > 0 ? param : null;
  }
}
