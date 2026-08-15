import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { validateEnv } from './config/env.validation';
import { DataRoomsModule } from './data-rooms/data-rooms.module';
import { DatabaseModule } from './database/database.module';
import { FilesModule } from './files/files.module';
import { FoldersModule } from './folders/folders.module';
import { HealthModule } from './health/health.module';
import { SharesModule } from './shares/shares.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    CommonModule,
    HealthModule,
    AuthModule,
    AccessModule,
    StorageModule,
    DataRoomsModule,
    FoldersModule,
    FilesModule,
    SharesModule,
  ],
})
export class AppModule {}
