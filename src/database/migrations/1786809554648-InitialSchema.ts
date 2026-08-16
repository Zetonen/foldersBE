import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1786809554648 implements MigrationInterface {
  name = 'InitialSchema1786809554648';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "share_resource_type_enum" AS ENUM ('DATA_ROOM', 'FOLDER', 'FILE')`,
    );
    await queryRunner.query(`CREATE TYPE "share_kind_enum" AS ENUM ('USER', 'PUBLIC_LINK')`);
    await queryRunner.query(`CREATE TYPE "share_role_enum" AS ENUM ('VIEWER')`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "name" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")`);

    await queryRunner.query(`
      CREATE TABLE "data_rooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "owner_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_data_rooms" PRIMARY KEY ("id"),
        CONSTRAINT "fk_data_rooms_owner" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_data_rooms_owner" ON "data_rooms" ("owner_id") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "folders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "data_room_id" uuid NOT NULL,
        "parent_id" uuid,
        "name" text NOT NULL,
        "path" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_folders" PRIMARY KEY ("id"),
        CONSTRAINT "fk_folders_data_room" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_folders_parent" FOREIGN KEY ("parent_id") REFERENCES "folders" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      -- text_pattern_ops is required because the default operator class of a
      -- collated text column cannot serve LIKE 'prefix%'. Every subtree query
      -- (list, stats, soft delete of a branch) is such a prefix match on path.
      CREATE INDEX "idx_folders_path_pattern" ON "folders" ("path" text_pattern_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_folders_room_parent" ON "folders" ("data_room_id", "parent_id", "name")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_folders_parent_name" ON "folders" ("parent_id", "name")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      -- NULLs never collide in a unique index, so the index above leaves folders
      -- at the room root (parent_id IS NULL) unconstrained. This one covers them.
      CREATE UNIQUE INDEX "uq_folders_room_root_name" ON "folders" ("data_room_id", "name")
      WHERE "parent_id" IS NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "files" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "data_room_id" uuid NOT NULL,
        "folder_id" uuid,
        "name" text NOT NULL,
        "size_bytes" bigint NOT NULL,
        "mime_type" text NOT NULL,
        "storage_key" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_files" PRIMARY KEY ("id"),
        CONSTRAINT "fk_files_data_room" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_files_folder" FOREIGN KEY ("folder_id") REFERENCES "folders" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_files_room_folder_name" ON "files" ("data_room_id", "folder_id", "name")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_files_folder_name" ON "files" ("folder_id", "name")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      -- same NULL gap as for folders: files sitting directly in the room root
      CREATE UNIQUE INDEX "uq_files_room_root_name" ON "files" ("data_room_id", "name")
      WHERE "folder_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_files_storage_key" ON "files" ("storage_key")`,
    );

    await queryRunner.query(`
      CREATE TABLE "shares" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "resource_type" "share_resource_type_enum" NOT NULL,
        "resource_id" uuid NOT NULL,
        "kind" "share_kind_enum" NOT NULL,
        "role" "share_role_enum" NOT NULL DEFAULT 'VIEWER',
        "grantee_user_id" uuid,
        "grantee_email" text,
        "token" text,
        "created_by" uuid NOT NULL,
        "expires_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "revoked_at" timestamptz,
        CONSTRAINT "pk_shares" PRIMARY KEY ("id"),
        CONSTRAINT "fk_shares_grantee_user" FOREIGN KEY ("grantee_user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_shares_created_by" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_shares_public_link_token" CHECK ("kind" <> 'PUBLIC_LINK' OR ("token" IS NOT NULL AND length("token") > 0)),
        CONSTRAINT "chk_shares_user_grantee" CHECK ("kind" <> 'USER' OR ("token" IS NULL AND ("grantee_user_id" IS NOT NULL OR "grantee_email" IS NOT NULL)))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_shares_token" ON "shares" ("token") WHERE "token" IS NOT NULL`,
    );
    await queryRunner.query(`
      -- one live public link per resource; revoking sets revoked_at, which drops
      -- the row out of this index and lets a fresh link be issued
      CREATE UNIQUE INDEX "uq_shares_active_public_link" ON "shares" ("resource_id")
      WHERE "kind" = 'PUBLIC_LINK' AND "revoked_at" IS NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_shares_grantee" ON "shares" ("grantee_user_id", "revoked_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_shares_resource" ON "shares" ("resource_id", "revoked_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shares"`);
    await queryRunner.query(`DROP TABLE "files"`);
    await queryRunner.query(`DROP TABLE "folders"`);
    await queryRunner.query(`DROP TABLE "data_rooms"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "share_role_enum"`);
    await queryRunner.query(`DROP TYPE "share_kind_enum"`);
    await queryRunner.query(`DROP TYPE "share_resource_type_enum"`);
  }
}
