import { Inject, Injectable } from '@nestjs/common';
import { ACCESS_REPOSITORY, AccessDecision, AccessRepository, ResolveInput } from './access.types';
import { maxRole, Role } from './role.enum';

@Injectable()
export class AccessResolverService {
  constructor(@Inject(ACCESS_REPOSITORY) private readonly repository: AccessRepository) {}

  async resolveRole(input: ResolveInput): Promise<Role | null> {
    const decision = await this.resolve(input);

    return decision?.role ?? null;
  }

  async resolve(input: ResolveInput): Promise<AccessDecision | null> {
    const node = await this.repository.loadResource(input.resourceType, input.resourceId);

    if (!node) {
      return null;
    }

    if (input.actor && node.ownerId === input.actor.id) {
      return { role: Role.Owner, node, boundaryId: null };
    }

    if (!input.actor && !input.token) {
      return null;
    }

    const grants = await this.repository.findGrants(node.ancestorIds, input.actor, input.token);

    if (grants.length === 0) {
      return null;
    }

    const depthById = new Map(node.ancestorIds.map((id, index) => [id, index]));

    let role: Role | null = null;
    let boundaryId: string | null = null;
    let boundaryDepth = Number.POSITIVE_INFINITY;

    for (const grant of grants) {
      const depth = depthById.get(grant.resourceId);

      if (depth === undefined) {
        continue;
      }

      role = maxRole(role, grant.role);

      if (depth < boundaryDepth) {
        boundaryDepth = depth;
        boundaryId = grant.resourceId;
      }
    }

    if (role === null) {
      return null;
    }

    return { role, node, boundaryId };
  }
}
