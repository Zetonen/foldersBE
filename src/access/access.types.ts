import { ShareResourceType } from '../shares/enums/share.enums';
import { Role } from './role.enum';

export const ACCESS_REPOSITORY = Symbol('ACCESS_REPOSITORY');

export interface AccessActor {
  id: string;
  email: string;
}

export interface ResourceNode {
  type: ShareResourceType;
  id: string;
  dataRoomId: string;
  ownerId: string;
  ancestorIds: string[];
}

export interface ShareGrant {
  id: string;
  resourceId: string;
  role: Role;
}

export interface ResolveInput {
  actor: AccessActor | null;
  token: string | null;
  resourceType: ShareResourceType;
  resourceId: string;
}

export interface AccessDecision {
  role: Role;
  node: ResourceNode;
  boundaryId: string | null;
}

export interface AccessRepository {
  loadResource(type: ShareResourceType, id: string): Promise<ResourceNode | null>;

  findGrants(
    resourceIds: string[],
    actor: AccessActor | null,
    token: string | null,
  ): Promise<ShareGrant[]>;
}
