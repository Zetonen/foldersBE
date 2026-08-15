import { StorageClient } from '@supabase/storage-js';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { config as loadEnv } from 'dotenv';
import { DataSource, EntityManager } from 'typeorm';
import { dataSourceOptions } from '../data-source';

loadEnv();

const PASSWORD = 'password123';

const USERS = [
  { email: 'alice@dataroom.dev', name: 'Alice Owner' },
  { email: 'bob@dataroom.dev', name: 'Bob Viewer' },
];

const ROOM_NAME = 'Acme Acquisition';

const TREE: Array<{ path: string[]; files: string[] }> = [
  { path: ['Due Diligence'], files: ['checklist.pdf'] },
  { path: ['Due Diligence', 'Financials'], files: ['summary.pdf', 'balance-sheet.pdf'] },
  { path: ['Due Diligence', 'Financials', '2026'], files: ['annual-report.pdf'] },
  {
    path: ['Due Diligence', 'Financials', '2026', 'Q1'],
    files: ['q1-statement.pdf', 'q1-notes.pdf', 'q1-audit.pdf'],
  },
  { path: ['Legal'], files: ['nda.pdf', 'articles.pdf'] },
  { path: ['Legal', 'Contracts'], files: ['msa.pdf'] },
];

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

function storage(): StorageClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return new StorageClient(`${url.replace(/\/$/, '')}/storage/v1`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
}

async function upsertUser(manager: EntityManager, email: string, name: string): Promise<string> {
  const existing: Array<{ id: string }> = await manager.query(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  const rows: Array<{ id: string }> = await manager.query(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id`,
    [email, await bcrypt.hash(PASSWORD, 10), name],
  );

  return rows[0].id;
}

async function upsertRoom(manager: EntityManager, ownerId: string): Promise<string> {
  const existing: Array<{ id: string }> = await manager.query(
    `SELECT id FROM data_rooms WHERE owner_id = $1 AND name = $2 AND deleted_at IS NULL`,
    [ownerId, ROOM_NAME],
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  const rows: Array<{ id: string }> = await manager.query(
    `INSERT INTO data_rooms (name, owner_id) VALUES ($1, $2) RETURNING id`,
    [ROOM_NAME, ownerId],
  );

  return rows[0].id;
}

async function upsertFolder(
  manager: EntityManager,
  roomId: string,
  parent: { id: string; path: string } | null,
  name: string,
): Promise<{ id: string; path: string }> {
  const existing: Array<{ id: string; path: string }> = await manager.query(
    `
      SELECT id, path FROM folders
      WHERE data_room_id = $1 AND name = $2 AND deleted_at IS NULL
        AND parent_id IS NOT DISTINCT FROM $3::uuid
    `,
    [roomId, name, parent?.id ?? null],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const id = randomUUID();
  const path = `${parent?.path ?? '/'}${id}/`;

  await manager.query(
    `INSERT INTO folders (id, data_room_id, parent_id, name, path) VALUES ($1, $2, $3, $4, $5)`,
    [id, roomId, parent?.id ?? null, name, path],
  );

  return { id, path };
}

async function upsertFile(
  manager: EntityManager,
  client: StorageClient | null,
  bucket: string,
  roomId: string,
  folderId: string,
  name: string,
): Promise<void> {
  const existing: Array<{ id: string }> = await manager.query(
    `SELECT id FROM files WHERE data_room_id = $1 AND folder_id = $2 AND name = $3 AND deleted_at IS NULL`,
    [roomId, folderId, name],
  );

  if (existing.length > 0) {
    return;
  }

  const storageKey = `${roomId}/${randomUUID()}`;

  if (client) {
    const { error } = await client
      .from(bucket)
      .upload(storageKey, PDF, { contentType: 'application/pdf', upsert: true });

    if (error) {
      throw new Error(`Storage upload failed for ${name}: ${error.message}`);
    }
  }

  await manager.query(
    `
      INSERT INTO files (data_room_id, folder_id, name, size_bytes, mime_type, storage_key)
      VALUES ($1, $2, $3, $4, 'application/pdf', $5)
    `,
    [roomId, folderId, name, PDF.length, storageKey],
  );
}

async function upsertUserShare(
  manager: EntityManager,
  resourceId: string,
  granteeId: string,
  granteeEmail: string,
  createdBy: string,
): Promise<void> {
  const existing: Array<{ id: string }> = await manager.query(
    `
      SELECT id FROM shares
      WHERE resource_id = $1 AND kind = 'USER' AND revoked_at IS NULL
        AND lower(grantee_email) = $2
    `,
    [resourceId, granteeEmail],
  );

  if (existing.length > 0) {
    return;
  }

  await manager.query(
    `
      INSERT INTO shares (resource_type, resource_id, kind, role, grantee_user_id, grantee_email, created_by)
      VALUES ('FOLDER', $1, 'USER', 'VIEWER', $2, $3, $4)
    `,
    [resourceId, granteeId, granteeEmail, createdBy],
  );
}

async function upsertPublicLink(
  manager: EntityManager,
  resourceId: string,
  createdBy: string,
): Promise<string> {
  const existing: Array<{ token: string }> = await manager.query(
    `
      SELECT token FROM shares
      WHERE resource_id = $1 AND kind = 'PUBLIC_LINK' AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
    `,
    [resourceId],
  );

  if (existing.length > 0) {
    return existing[0].token;
  }

  const rows: Array<{ token: string }> = await manager.query(
    `
      INSERT INTO shares (resource_type, resource_id, kind, role, token, created_by)
      VALUES ('FOLDER', $1, 'PUBLIC_LINK', 'VIEWER', $2, $3)
      RETURNING token
    `,
    [resourceId, randomBytes(32).toString('base64url'), createdBy],
  );

  return rows[0].token;
}

async function seed(): Promise<void> {
  const dataSource = await new DataSource(dataSourceOptions).initialize();
  const client = storage();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? '';

  if (!client) {
    console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — file rows will point at objects that do not exist');
  }

  const summary = await dataSource.transaction(async (manager) => {
    const [aliceId, bobId] = await Promise.all(
      USERS.map((user) => upsertUser(manager, user.email, user.name)),
    );
    const roomId = await upsertRoom(manager, aliceId);

    const folders = new Map<string, { id: string; path: string }>();

    for (const branch of TREE) {
      let parent: { id: string; path: string } | null = null;

      for (let depth = 0; depth < branch.path.length; depth += 1) {
        const key = branch.path.slice(0, depth + 1).join('/');
        const folder: { id: string; path: string } =
          folders.get(key) ?? (await upsertFolder(manager, roomId, parent, branch.path[depth]));

        folders.set(key, folder);
        parent = folder;
      }

      for (const fileName of branch.files) {
        await upsertFile(manager, client, bucket, roomId, (parent as { id: string }).id, fileName);
      }
    }

    const financials = folders.get('Due Diligence/Financials') as { id: string };
    const q1 = folders.get('Due Diligence/Financials/2026/Q1') as { id: string };

    await upsertUserShare(manager, financials.id, bobId, USERS[1].email, aliceId);
    const token = await upsertPublicLink(manager, q1.id, aliceId);

    const counts: Array<{ folders: string; files: string }> = await manager.query(
      `
        SELECT
          (SELECT count(*) FROM folders WHERE data_room_id = $1 AND deleted_at IS NULL) AS folders,
          (SELECT count(*) FROM files WHERE data_room_id = $1 AND deleted_at IS NULL) AS files
      `,
      [roomId],
    );

    return {
      roomId,
      sharedFolderId: financials.id,
      publicFolderId: q1.id,
      token,
      folders: counts[0].folders,
      files: counts[0].files,
    };
  });

  await dataSource.destroy();

  console.log('Seed complete');
  console.log(`  owner    ${USERS[0].email} / ${PASSWORD}`);
  console.log(`  viewer   ${USERS[1].email} / ${PASSWORD}`);
  console.log(`  room     ${summary.roomId} (${ROOM_NAME})`);
  console.log(`  tree     ${summary.folders} folders, ${summary.files} files`);
  console.log(`  share    folder ${summary.sharedFolderId} -> ${USERS[1].email}`);
  console.log(`  link     GET /share/${summary.token}`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
