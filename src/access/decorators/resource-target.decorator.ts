import { SetMetadata } from '@nestjs/common';
import { ShareResourceType } from '../../shares/enums/share.enums';
import { Role } from '../role.enum';

export const RESOURCE_TARGET_KEY = 'resourceTarget';
export const REQUIRE_ROLE_KEY = 'requireRole';

export type TargetSource = 'params' | 'body' | 'query';

export interface ResourceTargetMeta {
  type?: ShareResourceType;
  typeFrom?: TargetSource;
  typeKey?: string;
  from: TargetSource;
  key: string;
}

export const ResourceTarget = (meta: ResourceTargetMeta) => SetMetadata(RESOURCE_TARGET_KEY, meta);

export const RequireRole = (role: Role) => SetMetadata(REQUIRE_ROLE_KEY, role);
