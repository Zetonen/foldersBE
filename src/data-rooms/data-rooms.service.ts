import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { CreateDataRoomDto, RenameDataRoomDto } from './dto/data-room.dto';
import { DataRoom } from './entities/data-room.entity';

@Injectable()
export class DataRoomsService {
  constructor(
    @InjectRepository(DataRoom)
    private readonly dataRoomsRepository: Repository<DataRoom>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async assertOwnership(
    userId: string,
    dataRoomId: string,
    manager?: EntityManager,
  ): Promise<DataRoom> {
    const repository = manager ? manager.getRepository(DataRoom) : this.dataRoomsRepository;
    const room = await repository.findOne({ where: { id: dataRoomId, deletedAt: IsNull() } });

    if (!room || room.ownerId !== userId) {
      throw new NotFoundException('Data room not found');
    }

    return room;
  }

  async create(userId: string, dto: CreateDataRoomDto): Promise<DataRoom> {
    const room = this.dataRoomsRepository.create({ name: dto.name, ownerId: userId });

    return this.dataRoomsRepository.save(room);
  }

  findMine(userId: string): Promise<DataRoom[]> {
    return this.dataRoomsRepository.find({
      where: { ownerId: userId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async rename(userId: string, dataRoomId: string, dto: RenameDataRoomDto): Promise<DataRoom> {
    const room = await this.assertOwnership(userId, dataRoomId);
    room.name = dto.name;

    return this.dataRoomsRepository.save(room);
  }

  async softDelete(userId: string, dataRoomId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.assertOwnership(userId, dataRoomId, manager);

      await manager.query(
        `UPDATE files SET deleted_at = now() WHERE data_room_id = $1 AND deleted_at IS NULL`,
        [dataRoomId],
      );
      await manager.query(
        `UPDATE folders SET deleted_at = now() WHERE data_room_id = $1 AND deleted_at IS NULL`,
        [dataRoomId],
      );
      await manager.query(
        `UPDATE data_rooms SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
        [dataRoomId],
      );
    });
  }
}
