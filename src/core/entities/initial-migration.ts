import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration implements MigrationInterface {
    name = 'Migration1735970741340'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS auth`);
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS storage`);
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS metadata`);
        await queryRunner.query(`CREATE TABLE "auth"."tokens" ("$id" character varying NOT NULL, "$createdAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$updatedAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$deletedAt" TIMESTAMP(0) WITH TIME ZONE, "$permissions" text, "userId" character varying(255), "type" integer NOT NULL, "secret" character varying(512), "expire" TIMESTAMP, "userAgent" character varying(16384), "ip" character varying(45), "user_$id" character varying, CONSTRAINT "PK_33667e81d016935e50924ecb677" PRIMARY KEY ("$id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_54ff822a5a8ac32ef4c49a76b5" ON "auth"."tokens" ("user_$id") `);
        await queryRunner.query(`CREATE TABLE "auth"."authenticators" ("$id" character varying NOT NULL, "$createdAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$updatedAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$deletedAt" TIMESTAMP(0) WITH TIME ZONE, "$permissions" text, "userId" character varying(255), "type" character varying(255), "verified" boolean DEFAULT false, "data" text, "user_$id" character varying, CONSTRAINT "PK_34ab6385ab9aa1cc42a44672feb" PRIMARY KEY ("$id"))`);
        await queryRunner.query(`CREATE TABLE "auth"."challenges" ("$id" character varying NOT NULL, "$createdAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$updatedAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$deletedAt" TIMESTAMP(0) WITH TIME ZONE, "$permissions" text, "userId" character varying(255), "type" character varying(255), "token" character varying(512), "code" character varying(512), "expire" TIMESTAMP WITH TIME ZONE, "user_$id" character varying, CONSTRAINT "PK_1a0f5cae9b7151489933ddc677e" PRIMARY KEY ("$id"))`);
        await queryRunner.query(`CREATE INDEX "idx_user_id" ON "auth"."challenges" ("user_$id") `);
        await queryRunner.query(`CREATE TABLE "auth"."sessions" ("$id" character varying NOT NULL, "$createdAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$updatedAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$deletedAt" TIMESTAMP(0) WITH TIME ZONE, "$permissions" text, "userId" character varying(255), "provider" character varying(128), "providerUid" character varying(2048), "providerAccessToken" character varying(16384), "providerAccessTokenExpiry" TIMESTAMP WITH TIME ZONE, "providerRefreshToken" character varying(16384), "secret" character varying(512), "userAgent" character varying(16384), "ip" character varying(45), "countryCode" character varying(2), "osCode" character varying(256), "osName" character varying(256), "osVersion" character varying(256), "clientType" character varying(256), "clientCode" character varying(256), "clientName" character varying(256), "clientVersion" character varying(256), "clientEngine" character varying(256), "clientEngineVersion" character varying(256), "deviceName" character varying(256), "deviceBrand" character varying(256), "deviceModel" character varying(256), "factors" text, "expire" TIMESTAMP WITH TIME ZONE NOT NULL, "mfaUpdatedAt" TIMESTAMP WITH TIME ZONE, "user_$id" character varying, CONSTRAINT "PK_8a86b7768004b486f08045a88a4" PRIMARY KEY ("$id"))`);
        await queryRunner.query(`CREATE TABLE "auth"."teams" ("$id" character varying NOT NULL, "$createdAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$updatedAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$deletedAt" TIMESTAMP(0) WITH TIME ZONE, "$permissions" text, "name" character varying(128), "total" integer, "search" character varying(16384), "prefs" json DEFAULT '{}', CONSTRAINT "PK_8ab0e7f6929b00e3c0037badec3" PRIMARY KEY ("$id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_48c0c32e6247a2de155baeaf98" ON "auth"."teams" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6ada59c75ff2761704cccebd8" ON "auth"."teams" ("total") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4ab53f394a0ccc38437919456" ON "auth"."teams" ("search") `);
        await queryRunner.query(`CREATE TABLE "auth"."memberships" ("$id" character varying NOT NULL, "$createdAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$updatedAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$deletedAt" TIMESTAMP(0) WITH TIME ZONE, "$permissions" text, "userId" character varying(255), "teamId" character varying(255), "roles" character varying(128) array, "invited" TIMESTAMP WITH TIME ZONE, "joined" TIMESTAMP WITH TIME ZONE, "confirm" boolean, "secret" character varying(256), "search" character varying(16384), "user_$id" character varying, "team_$id" character varying, CONSTRAINT "PK_b89acea9c4634bedaae9fb248bf" PRIMARY KEY ("$id"))`);
        await queryRunner.query(`CREATE INDEX "confirm_index" ON "auth"."memberships" ("confirm") `);
        await queryRunner.query(`CREATE INDEX "joined_index" ON "auth"."memberships" ("joined") `);
        await queryRunner.query(`CREATE INDEX "invited_index" ON "auth"."memberships" ("invited") `);
        await queryRunner.query(`CREATE INDEX "teamId_index" ON "auth"."memberships" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "userId_index" ON "auth"."memberships" ("userId") `);
        await queryRunner.query(`CREATE INDEX "search_index" ON "auth"."memberships" ("search") `);
        await queryRunner.query(`CREATE INDEX "team_index" ON "auth"."memberships" ("team_$id") `);
        await queryRunner.query(`CREATE INDEX "user_index" ON "auth"."memberships" ("user_$id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dba610eddac5ad4aed9a1f15a0" ON "auth"."memberships" ("team_$id", "user_$id") `);
        await queryRunner.query(`CREATE TABLE "auth"."targets" ("$id" character varying NOT NULL, "$createdAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$updatedAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$deletedAt" TIMESTAMP(0) WITH TIME ZONE, "$permissions" text, "userId" character varying(255) NOT NULL, "sessionId" character varying(255), "session" character varying(255), "providerType" character varying(255) NOT NULL, "providerId" character varying(255), "providerInternalId" character varying(255), "identifier" character varying(255) NOT NULL, "name" character varying(255), "expired" boolean DEFAULT false, "user_$id" character varying, CONSTRAINT "PK_6fa11ddf71bc871110c52ff2a9c" PRIMARY KEY ("$id"))`);
        await queryRunner.query(`CREATE TABLE "auth"."users" ("$id" character varying NOT NULL, "$createdAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$updatedAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$deletedAt" TIMESTAMP(0) WITH TIME ZONE, "$permissions" text, "name" character varying(256), "email" character varying(320), "phone" character varying(16), "status" boolean, "labels" character varying(128) array, "passwordHistory" character varying(16384) array, "password" character varying(16384), "hash" character varying(256), "hashOptions" json, "passwordUpdate" TIMESTAMP, "prefs" json, "registration" TIMESTAMP, "emailVerification" boolean, "phoneVerification" boolean, "reset" boolean, "mfa" boolean, "mfaRecoveryCodes" character varying(256) array, "search" character varying(16384), "accessedAt" TIMESTAMP, CONSTRAINT "PK_029bb68485cf2aa14191f0ab71f" PRIMARY KEY ("$id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ACCESSED_AT" ON "auth"."users" ("accessedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_SEARCH" ON "auth"."users" ("search") `);
        await queryRunner.query(`CREATE INDEX "IDX_PHONE_VERIFICATION" ON "auth"."users" ("phoneVerification") `);
        await queryRunner.query(`CREATE INDEX "IDX_EMAIL_VERIFICATION" ON "auth"."users" ("emailVerification") `);
        await queryRunner.query(`CREATE INDEX "IDX_REGISTRATION" ON "auth"."users" ("registration") `);
        await queryRunner.query(`CREATE INDEX "IDX_PASSWORD_UPDATE" ON "auth"."users" ("passwordUpdate") `);
        await queryRunner.query(`CREATE INDEX "IDX_STATUS" ON "auth"."users" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_PHONE" ON "auth"."users" ("phone") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_EMAIL" ON "auth"."users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_NAME" ON "auth"."users" ("name") `);
        await queryRunner.query(`CREATE TABLE "storage"."buckets" ("$id" character varying NOT NULL, "$createdAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$updatedAt" TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT now(), "$deletedAt" TIMESTAMP(0) WITH TIME ZONE, "$permissions" text, "enabled" boolean NOT NULL DEFAULT true, "name" character varying(128) NOT NULL, "fileSecurity" boolean NOT NULL DEFAULT false, "maximumFileSize" integer NOT NULL, "allowedFileExtensions" text NOT NULL, "compression" character varying(10) NOT NULL, "encryption" boolean NOT NULL DEFAULT true, "antivirus" boolean NOT NULL DEFAULT true, "search" character varying(16384), CONSTRAINT "PK_fb29515500697866ebac9b8cc66" PRIMARY KEY ("$id"))`);
        await queryRunner.query(`ALTER TABLE "auth"."tokens" ADD CONSTRAINT "FK_54ff822a5a8ac32ef4c49a76b55" FOREIGN KEY ("user_$id") REFERENCES "auth"."users"("$id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth"."authenticators" ADD CONSTRAINT "FK_9f658d52b5b51725e9fdf02754e" FOREIGN KEY ("user_$id") REFERENCES "auth"."users"("$id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth"."challenges" ADD CONSTRAINT "FK_de22071a992c5c7ff4023613d77" FOREIGN KEY ("user_$id") REFERENCES "auth"."users"("$id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth"."sessions" ADD CONSTRAINT "FK_0241275d44a68db4bd17d664f9b" FOREIGN KEY ("user_$id") REFERENCES "auth"."users"("$id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth"."memberships" ADD CONSTRAINT "FK_b82143094ef22e3a9605c50572f" FOREIGN KEY ("user_$id") REFERENCES "auth"."users"("$id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth"."memberships" ADD CONSTRAINT "FK_a35ff890a1533ad8d876f97a85a" FOREIGN KEY ("team_$id") REFERENCES "auth"."teams"("$id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth"."targets" ADD CONSTRAINT "FK_accb05b1b1318e8ee3e77c32885" FOREIGN KEY ("user_$id") REFERENCES "auth"."users"("$id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth"."targets" DROP CONSTRAINT "FK_accb05b1b1318e8ee3e77c32885"`);
        await queryRunner.query(`ALTER TABLE "auth"."memberships" DROP CONSTRAINT "FK_a35ff890a1533ad8d876f97a85a"`);
        await queryRunner.query(`ALTER TABLE "auth"."memberships" DROP CONSTRAINT "FK_b82143094ef22e3a9605c50572f"`);
        await queryRunner.query(`ALTER TABLE "auth"."sessions" DROP CONSTRAINT "FK_0241275d44a68db4bd17d664f9b"`);
        await queryRunner.query(`ALTER TABLE "auth"."challenges" DROP CONSTRAINT "FK_de22071a992c5c7ff4023613d77"`);
        await queryRunner.query(`ALTER TABLE "auth"."authenticators" DROP CONSTRAINT "FK_9f658d52b5b51725e9fdf02754e"`);
        await queryRunner.query(`ALTER TABLE "auth"."tokens" DROP CONSTRAINT "FK_54ff822a5a8ac32ef4c49a76b55"`);
        await queryRunner.query(`DROP TABLE "storage"."buckets"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_NAME"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_EMAIL"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_PHONE"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_STATUS"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_PASSWORD_UPDATE"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_REGISTRATION"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_EMAIL_VERIFICATION"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_PHONE_VERIFICATION"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_SEARCH"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_ACCESSED_AT"`);
        await queryRunner.query(`DROP TABLE "auth"."users"`);
        await queryRunner.query(`DROP TABLE "auth"."targets"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_dba610eddac5ad4aed9a1f15a0"`);
        await queryRunner.query(`DROP INDEX "auth"."user_index"`);
        await queryRunner.query(`DROP INDEX "auth"."team_index"`);
        await queryRunner.query(`DROP INDEX "auth"."search_index"`);
        await queryRunner.query(`DROP INDEX "auth"."userId_index"`);
        await queryRunner.query(`DROP INDEX "auth"."teamId_index"`);
        await queryRunner.query(`DROP INDEX "auth"."invited_index"`);
        await queryRunner.query(`DROP INDEX "auth"."joined_index"`);
        await queryRunner.query(`DROP INDEX "auth"."confirm_index"`);
        await queryRunner.query(`DROP TABLE "auth"."memberships"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_a4ab53f394a0ccc38437919456"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_d6ada59c75ff2761704cccebd8"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_48c0c32e6247a2de155baeaf98"`);
        await queryRunner.query(`DROP TABLE "auth"."teams"`);
        await queryRunner.query(`DROP TABLE "auth"."sessions"`);
        await queryRunner.query(`DROP INDEX "auth"."idx_user_id"`);
        await queryRunner.query(`DROP TABLE "auth"."challenges"`);
        await queryRunner.query(`DROP TABLE "auth"."authenticators"`);
        await queryRunner.query(`DROP INDEX "auth"."IDX_54ff822a5a8ac32ef4c49a76b5"`);
        await queryRunner.query(`DROP TABLE "auth"."tokens"`);
    }

}
