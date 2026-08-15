import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { DataRoomsController } from './data-rooms.controller';
import { DataRoomsService } from './data-rooms.service';
import { DataRoom } from './entities/data-room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DataRoom]), AuthModule, AccessModule],
  controllers: [DataRoomsController],
  providers: [DataRoomsService],
  exports: [DataRoomsService],
})
export class DataRoomsModule {}
