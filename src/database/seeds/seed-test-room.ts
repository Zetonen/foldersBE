import { StorageClient } from '@supabase/storage-js';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { config as loadEnv } from 'dotenv';
import { DataSource, EntityManager } from 'typeorm';
import { dataSourceOptions } from '../data-source';

loadEnv();

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'graf.lancelot7@gmail.com';
const OWNER_NAME = 'Test Owner';
const FALLBACK_PASSWORD = 'password123';
const ROOM_NAME = 'Test';
const FILE_COUNT = Number(process.env.SEED_FILE_COUNT ?? 1000);
const SKIP_STORAGE = (process.env.SEED_SKIP_STORAGE ?? '').toLowerCase() === 'true';
const UPLOAD_CONCURRENCY = 25;
const BATCH_SIZE = 200;

const LAYOUT: Array<{ path: string[]; weight: number }> = [
  { path: [], weight: 12 },
  { path: ['Bulk'], weight: 50 },
  { path: ['Reports', '2024'], weight: 10 },
  { path: ['Reports', '2025'], weight: 10 },
  { path: ['Reports', '2026'], weight: 10 },
  { path: ['Archive', 'Legal', 'Contracts'], weight: 8 },
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

function planCounts(total: number): number[] {
  const weightSum = LAYOUT.reduce((sum, entry) => sum + entry.weight, 0);
  const counts = LAYOUT.map((entry) => Math.floor((total * entry.weight) / weightSum));
  const assigned = counts.reduce((sum, count) => sum + count, 0);

  counts[counts.length - 1] += total - assigned;

  return counts;
}

async function findOrCreateOwner(
  manager: EntityManager,
): Promise<{ id: string; created: boolean }> {
  const existing: Array<{ id: string }> = await manager.query(
    `SELECT id FROM users WHERE email = $1`,
    [OWNER_EMAIL],
  );

  if (existing.length > 0) {
    return { id: existing[0].id, created: false };
  }

  const rows: Array<{ id: string }> = await manager.query(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id`,
    [OWNER_EMAIL, await bcrypt.hash(FALLBACK_PASSWORD, 10), OWNER_NAME],
  );

  return { id: rows[0].id, created: true };
}

async function findOrCreateRoom(manager: EntityManager, ownerId: string): Promise<string> {
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

async function findOrCreateFolder(
  manager: EntityManager,
  roomId: string,
  parent: { id: string; path: string } | null,
  name: string,
): Promise<{ id: string; path: string }> {
  const existing: Array<{ id: string; path: string }> = await manager.query(
    `
      SELECT id, path FROM folders
      WHERE data_room_id = $1 AND name = $2 AND deleted_at IS NULL
        AND parent_id IS NOT DISTINCT FROM $3
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

async function uploadAll(
  client: StorageClient,
  bucket: string,
  keys: string[],
  onProgress: (done: number) => void,
): Promise<void> {
  let cursor = 0;
  let done = 0;

  const worker = async (): Promise<void> => {
    while (cursor < keys.length) {
      const key = keys[cursor];
      cursor += 1;

      const { error } = await client
        .from(bucket)
        .upload(key, PDF, { contentType: 'application/pdf', upsert: true });

      if (error) {
        throw new Error(`Storage upload failed for ${key}: ${error.message}`);
      }

      done += 1;
      onProgress(done);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, keys.length) }, () => worker()),
  );
}

async function seed(): Promise<void> {
  const dataSource = await new DataSource(dataSourceOptions).initialize();
  const client = storage();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? '';

  if (!client && !SKIP_STORAGE) {
    throw new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Set them, or run with SEED_SKIP_STORAGE=true to create rows without objects.',
    );
  }

  const counts = planCounts(FILE_COUNT);
  const pending: Array<{ storageKey: string }> = [];

  const summary = await dataSource.transaction(async (manager) => {
    const owner = await findOrCreateOwner(manager);
    const roomId = await findOrCreateRoom(manager, owner.id);

    const folders: Array<{ id: string | null; label: string }> = [];

    for (const entry of LAYOUT) {
      let parent: { id: string; path: string } | null = null;

      for (const name of entry.path) {
        parent = await findOrCreateFolder(manager, roomId, parent, name);
      }

      folders.push({ id: parent?.id ?? null, label: entry.path.join('/') || '(room root)' });
    }

    let created = 0;
    let skipped = 0;
    const perFolder: Array<{ label: string; total: number }> = [];

    for (let index = 0; index < folders.length; index += 1) {
      const folder = folders[index];
      const target = counts[index];

      const taken: Array<{ name: string }> = await manager.query(
        folder.id
          ? `SELECT name FROM files WHERE data_room_id = $1 AND folder_id = $2 AND deleted_at IS NULL`
          : `SELECT name FROM files WHERE data_room_id = $1 AND folder_id IS NULL AND deleted_at IS NULL`,
        folder.id ? [roomId, folder.id] : [roomId],
      );
      const existing = new Set(taken.map((row) => row.name));

      const rows: Array<[string, string | null, string, number, string]> = [];

      for (let n = 1; n <= target; n += 1) {
        const name = `document-${String(n).padStart(4, '0')}.pdf`;

        if (existing.has(name)) {
          skipped += 1;
          continue;
        }

        const storageKey = `${roomId}/${randomUUID()}`;
        pending.push({ storageKey });
        rows.push([roomId, folder.id, name, PDF.length, storageKey]);
        created += 1;
      }

      for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
        const batch = rows.slice(offset, offset + BATCH_SIZE);
        const tuples = batch.map((_, row) => {
          const base = row * 5;

          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, 'application/pdf', $${base + 5})`;
        });

        await manager.query(
          `
            INSERT INTO files (data_room_id, folder_id, name, size_bytes, mime_type, storage_key)
            VALUES ${tuples.join(', ')}
          `,
          batch.flat(),
        );
      }

      perFolder.push({ label: folder.label, total: target });
    }

    return { ownerId: owner.id, ownerCreated: owner.created, roomId, created, skipped, perFolder };
  });

  if (pending.length > 0 && client && !SKIP_STORAGE) {
    process.stdout.write(`uploading ${pending.length} objects `);
    await uploadAll(
      client,
      bucket,
      pending.map((item) => item.storageKey),
      (done) => {
        if (done % 100 === 0) {
          process.stdout.write('.');
        }
      },
    );
    process.stdout.write(' done\n');
  }

  await dataSource.destroy();

  console.log('\nTest room ready');
  console.log(`  owner    ${OWNER_EMAIL} (${summary.ownerId})`);

  if (summary.ownerCreated) {
    console.log(`           created just now, password ${FALLBACK_PASSWORD}`);
  } else {
    console.log('           existing account, password untouched');
  }

  console.log(`  room     ${summary.roomId} (${ROOM_NAME})`);
  console.log(`  files    ${summary.created} inserted, ${summary.skipped} already there`);

  for (const folder of summary.perFolder) {
    console.log(`             ${String(folder.total).padStart(4)}  ${folder.label}`);
  }

  if (SKIP_STORAGE || !client) {
    console.log('  storage  skipped — rows point at objects that do not exist, downloads will 404');
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
