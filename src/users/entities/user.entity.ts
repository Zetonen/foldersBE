import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('uq_users_email', { unique: true })
  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'text' })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
