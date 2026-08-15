import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { DataRoomsModule } from '../data-rooms/data-rooms.module';
import { Folder } from './entities/folder.entity';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { PathService } from './path.service';
import { RoomContentsController } from './room-contents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Folder]), AuthModule, AccessModule, DataRoomsModule],
  controllers: [FoldersController, RoomContentsController],
  providers: [FoldersService, PathService],
  exports: [FoldersService, PathService],
})
export class FoldersModule {}
