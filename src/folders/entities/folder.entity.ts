import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DataRoom } from '../../data-rooms/entities/data-room.entity';

@Entity('folders')
@Index('idx_folders_room_parent', ['dataRoomId', 'parentId', 'name'], {
  where: 'deleted_at IS NULL',
})
@Index('uq_folders_parent_name', ['parentId', 'name'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('uq_folders_room_root_name', ['dataRoomId', 'name'], {
  unique: true,
  where: 'parent_id IS NULL AND deleted_at IS NULL',
})
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'data_room_id' })
  dataRoomId!: string;

  @ManyToOne(() => DataRoom, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'data_room_id' })
  dataRoom!: DataRoom;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Folder, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: Folder | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  path!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
