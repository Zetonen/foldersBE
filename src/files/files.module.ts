import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { DataRoomsModule } from '../data-rooms/data-rooms.module';
import { FoldersModule } from '../folders/folders.module';
import { StorageModule } from '../storage/storage.module';
import { FileEntity } from './entities/file.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
    AuthModule,
    AccessModule,
    DataRoomsModule,
    FoldersModule,
    StorageModule,
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
