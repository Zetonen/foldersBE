import { AccessResolverService } from './access-resolver.service';
import { AccessActor, AccessRepository, ResourceNode, ShareGrant } from './access.types';
import { Role } from './role.enum';
import { ShareResourceType } from '../shares/enums/share.enums';

const ROOM = '00000000-0000-0000-0000-00000000r000';
const OWNER = '00000000-0000-0000-0000-0000000owner';
const BRANCH_A = 'aaaaaaaa-0000-0000-0000-00000000000a';
const CHILD_A = 'aaaaaaaa-0000-0000-0000-00000000000b';
const BRANCH_B = 'bbbbbbbb-0000-0000-0000-00000000000a';
const FILE_IN_A = 'ffffffff-0000-0000-0000-00000000000f';

const alice: AccessActor = { id: OWNER, email: 'alice@example.com' };
const bob: AccessActor = { id: 'bob-id', email: 'bob@example.com' };

const nodes: Record<string, ResourceNode> = {
  [ROOM]: {
    type: ShareResourceType.DataRoom,
    id: ROOM,
    dataRoomId: ROOM,
    ownerId: OWNER,
    ancestorIds: [ROOM],
  },
  [BRANCH_A]: {
    type: ShareResourceType.Folder,
    id: BRANCH_A,
    dataRoomId: ROOM,
    ownerId: OWNER,
    ancestorIds: [ROOM, BRANCH_A],
  },
  [CHILD_A]: {
    type: ShareResourceType.Folder,
    id: CHILD_A,
    dataRoomId: ROOM,
    ownerId: OWNER,
    ancestorIds: [ROOM, BRANCH_A, CHILD_A],
  },
  [BRANCH_B]: {
    type: ShareResourceType.Folder,
    id: BRANCH_B,
    dataRoomId: ROOM,
    ownerId: OWNER,
    ancestorIds: [ROOM, BRANCH_B],
  },
  [FILE_IN_A]: {
    type: ShareResourceType.File,
    id: FILE_IN_A,
    dataRoomId: ROOM,
    ownerId: OWNER,
    ancestorIds: [ROOM, BRANCH_A, CHILD_A, FILE_IN_A],
  },
};

interface StoredShare {
  id: string;
  resourceId: string;
  role: Role;
  granteeUserId?: string;
  granteeEmail?: string;
  token?: string;
  revoked?: boolean;
  expiresAt?: Date;
}

function repositoryWith(shares: StoredShare[]): AccessRepository {
  return {
    loadResource: async (_type, id) => nodes[id] ?? null,
    findGrants: async (resourceIds, actor, token): Promise<ShareGrant[]> =>
      shares
        .filter((share) => resourceIds.includes(share.resourceId))
        .filter((share) => !share.revoked)
        .filter((share) => !share.expiresAt || share.expiresAt > new Date())
        .filter((share) => {
          if (share.token) {
            return token !== null && share.token === token;
          }

          return (
            actor !== null &&
            (share.granteeUserId === actor.id ||
              share.granteeEmail?.toLowerCase() === actor.email.toLowerCase())
          );
        })
        .map((share) => ({ id: share.id, resourceId: share.resourceId, role: share.role })),
  };
}

function resolverWith(shares: StoredShare[]): AccessResolverService {
  return new AccessResolverService(repositoryWith(shares));
}

describe('AccessResolverService', () => {
  it('returns OWNER for the data room owner without touching shares', async () => {
    const repository = repositoryWith([]);
    const findGrants = jest.spyOn(repository, 'findGrants');
    const resolver = new AccessResolverService(repository);

    const decision = await resolver.resolve({
      actor: alice,
      token: null,
      resourceType: ShareResourceType.Folder,
      resourceId: CHILD_A,
    });

    expect(decision?.role).toBe(Role.Owner);
    expect(decision?.boundaryId).toBeNull();
    expect(findGrants).not.toHaveBeenCalled();
  });

  it('grants VIEWER through a named share on an ancestor folder', async () => {
    const resolver = resolverWith([
      { id: 's1', resourceId: BRANCH_A, role: Role.Viewer, granteeUserId: bob.id },
    ]);

    const decision = await resolver.resolve({
      actor: bob,
      token: null,
      resourceType: ShareResourceType.File,
      resourceId: FILE_IN_A,
    });

    expect(decision?.role).toBe(Role.Viewer);
    expect(decision?.boundaryId).toBe(BRANCH_A);
  });

  it('matches a named share issued to an email before the user registered', async () => {
    const resolver = resolverWith([
      { id: 's1', resourceId: BRANCH_A, role: Role.Viewer, granteeEmail: 'BOB@example.com' },
    ]);

    const role = await resolver.resolveRole({
      actor: bob,
      token: null,
      resourceType: ShareResourceType.Folder,
      resourceId: CHILD_A,
    });

    expect(role).toBe(Role.Viewer);
  });

  it('grants VIEWER through a public token on an ancestor folder', async () => {
    const resolver = resolverWith([
      { id: 's1', resourceId: BRANCH_A, role: Role.Viewer, token: 'tok' },
    ]);

    const decision = await resolver.resolve({
      actor: null,
      token: 'tok',
      resourceType: ShareResourceType.Folder,
      resourceId: CHILD_A,
    });

    expect(decision?.role).toBe(Role.Viewer);
    expect(decision?.boundaryId).toBe(BRANCH_A);
  });

  it('refuses a token whose share sits on a sibling branch', async () => {
    const resolver = resolverWith([
      { id: 's1', resourceId: BRANCH_B, role: Role.Viewer, token: 'tok' },
    ]);

    const role = await resolver.resolveRole({
      actor: null,
      token: 'tok',
      resourceType: ShareResourceType.Folder,
      resourceId: CHILD_A,
    });

    expect(role).toBeNull();
  });

  it('refuses a token that does not match any share', async () => {
    const resolver = resolverWith([
      { id: 's1', resourceId: BRANCH_A, role: Role.Viewer, token: 'tok' },
    ]);

    const role = await resolver.resolveRole({
      actor: null,
      token: 'wrong-token',
      resourceType: ShareResourceType.Folder,
      resourceId: CHILD_A,
    });

    expect(role).toBeNull();
  });

  it('refuses a revoked share', async () => {
    const resolver = resolverWith([
      { id: 's1', resourceId: BRANCH_A, role: Role.Viewer, granteeUserId: bob.id, revoked: true },
    ]);

    const role = await resolver.resolveRole({
      actor: bob,
      token: null,
      resourceType: ShareResourceType.Folder,
      resourceId: CHILD_A,
    });

    expect(role).toBeNull();
  });

  it('refuses an expired share', async () => {
    const resolver = resolverWith([
      {
        id: 's1',
        resourceId: BRANCH_A,
        role: Role.Viewer,
        granteeUserId: bob.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);

    const role = await resolver.resolveRole({
      actor: bob,
      token: null,
      resourceType: ShareResourceType.Folder,
      resourceId: CHILD_A,
    });

    expect(role).toBeNull();
  });

  it('accepts a share that has not expired yet', async () => {
    const resolver = resolverWith([
      {
        id: 's1',
        resourceId: BRANCH_A,
        role: Role.Viewer,
        granteeUserId: bob.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    const role = await resolver.resolveRole({
      actor: bob,
      token: null,
      resourceType: ShareResourceType.Folder,
      resourceId: CHILD_A,
    });

    expect(role).toBe(Role.Viewer);
  });

  it('returns null for an anonymous request without a token', async () => {
    const resolver = resolverWith([
      { id: 's1', resourceId: BRANCH_A, role: Role.Viewer, token: 'tok' },
    ]);

    const role = await resolver.resolveRole({
      actor: null,
      token: null,
      resourceType: ShareResourceType.Folder,
      resourceId: CHILD_A,
    });

    expect(role).toBeNull();
  });

  it('returns null for a missing or deleted resource', async () => {
    const resolver = resolverWith([]);

    const role = await resolver.resolveRole({
      actor: alice,
      token: null,
      resourceType: ShareResourceType.Folder,
      resourceId: 'unknown-id',
    });

    expect(role).toBeNull();
  });

  it('keeps the boundary at the highest matching share', async () => {
    const resolver = resolverWith([
      { id: 's1', resourceId: BRANCH_A, role: Role.Viewer, granteeUserId: bob.id },
      { id: 's2', resourceId: CHILD_A, role: Role.Viewer, granteeUserId: bob.id },
    ]);

    const decision = await resolver.resolve({
      actor: bob,
      token: null,
      resourceType: ShareResourceType.File,
      resourceId: FILE_IN_A,
    });

    expect(decision?.boundaryId).toBe(BRANCH_A);
  });

  it('grants access to a whole room through a data room share', async () => {
    const resolver = resolverWith([
      { id: 's1', resourceId: ROOM, role: Role.Viewer, granteeUserId: bob.id },
    ]);

    const decision = await resolver.resolve({
      actor: bob,
      token: null,
      resourceType: ShareResourceType.File,
      resourceId: FILE_IN_A,
    });

    expect(decision?.role).toBe(Role.Viewer);
    expect(decision?.boundaryId).toBe(ROOM);
  });
});
