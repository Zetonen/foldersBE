import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  SHARE_KIND_ENUM_NAME,
  SHARE_RESOURCE_TYPE_ENUM_NAME,
  SHARE_ROLE_ENUM_NAME,
  ShareKind,
  ShareResourceType,
  ShareRole,
} from '../enums/share.enums';

@Entity('shares')
@Index('idx_shares_resource', ['resourceId', 'revokedAt'])
@Index('idx_shares_grantee', ['granteeUserId', 'revokedAt'])
@Index('uq_shares_token', ['token'], { unique: true, where: 'token IS NOT NULL' })
@Index('uq_shares_active_public_link', ['resourceId'], {
  unique: true,
  where: "kind = 'PUBLIC_LINK' AND revoked_at IS NULL",
})
@Check(
  'chk_shares_public_link_token',
  "kind <> 'PUBLIC_LINK' OR (token IS NOT NULL AND length(token) > 0)",
)
@Check(
  'chk_shares_user_grantee',
  "kind <> 'USER' OR (token IS NULL AND (grantee_user_id IS NOT NULL OR grantee_email IS NOT NULL))",
)
export class Share {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: ShareResourceType,
    enumName: SHARE_RESOURCE_TYPE_ENUM_NAME,
    name: 'resource_type',
  })
  resourceType!: ShareResourceType;

  @Column({ type: 'uuid', name: 'resource_id' })
  resourceId!: string;

  @Column({ type: 'enum', enum: ShareKind, enumName: SHARE_KIND_ENUM_NAME })
  kind!: ShareKind;

  @Column({
    type: 'enum',
    enum: ShareRole,
    enumName: SHARE_ROLE_ENUM_NAME,
    default: ShareRole.Viewer,
  })
  role!: ShareRole;

  @Column({ type: 'uuid', name: 'grantee_user_id', nullable: true })
  granteeUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'grantee_user_id' })
  granteeUser!: User | null;

  @Column({ type: 'text', name: 'grantee_email', nullable: true })
  granteeEmail!: string | null;

  @Column({ type: 'text', nullable: true })
  token!: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator!: User;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;
}
