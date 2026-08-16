import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoogleAuth1786872466413 implements MigrationInterface {
  name = 'GoogleAuth1786872466413';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "google_id" text`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_google_id" ON "users" ("google_id") WHERE "google_id" IS NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "chk_users_credentials"
      CHECK ("password_hash" IS NOT NULL OR "google_id" IS NOT NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "chk_users_credentials"`);
    await queryRunner.query(`DROP INDEX "uq_users_google_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "google_id"`);
    await queryRunner.query(`DELETE FROM "users" WHERE "password_hash" IS NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
  }
}
