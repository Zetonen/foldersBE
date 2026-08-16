import { ShareRole } from '../shares/enums/share.enums';

export enum Role {
  Viewer = 'VIEWER',
  Owner = 'OWNER',
}

const RANK: Record<Role, number> = {
  [Role.Viewer]: 10,
  [Role.Owner]: 100,
};

const SHARE_ROLE_TO_ROLE: Record<ShareRole, Role> = {
  [ShareRole.Viewer]: Role.Viewer,
};

export function maxRole(a: Role | null, b: Role): Role {
  return a === null || RANK[b] > RANK[a] ? b : a;
}

export function fromShareRole(role: ShareRole): Role {
  return SHARE_ROLE_TO_ROLE[role];
}

export function satisfies(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required];
}
