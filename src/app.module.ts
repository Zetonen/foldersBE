import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { validateEnv } from './config/env.validation';
import { DataRoomsModule } from './data-rooms/data-rooms.module';
import { DatabaseModule } from './database/database.module';
import { FoldersModule } from './folders/folders.module';
import { HealthModule } from './health/health.module';

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
    DataRoomsModule,
    FoldersModule,
  ],
})
export class AppModule {}
