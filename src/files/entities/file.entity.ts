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
import { bigintTransformer } from '../../common/transformers/bigint.transformer';
import { DataRoom } from '../../data-rooms/entities/data-room.entity';
import { Folder } from '../../folders/entities/folder.entity';

@Entity('files')
@Index('idx_files_room_folder_name', ['dataRoomId', 'folderId', 'name'])
@Index('uq_files_folder_name', ['folderId', 'name'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('uq_files_room_root_name', ['dataRoomId', 'name'], {
  unique: true,
  where: 'folder_id IS NULL AND deleted_at IS NULL',
})
@Index('uq_files_storage_key', ['storageKey'], { unique: true })
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'data_room_id' })
  dataRoomId!: string;

  @ManyToOne(() => DataRoom, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'data_room_id' })
  dataRoom!: DataRoom;

  @Column({ type: 'uuid', name: 'folder_id', nullable: true })
  folderId!: string | null;

  @ManyToOne(() => Folder, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'folder_id' })
  folder!: Folder | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'bigint', name: 'size_bytes', transformer: bigintTransformer })
  sizeBytes!: number;

  @Column({ type: 'text', name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'text', name: 'storage_key' })
  storageKey!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
