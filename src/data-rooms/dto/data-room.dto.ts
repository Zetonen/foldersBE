import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  NAME_MAX_LENGTH,
  NAME_PATTERN,
  NAME_PATTERN_MESSAGE,
} from '../../common/validation/name.rules';
import { DataRoom } from '../entities/data-room.entity';

export class CreateDataRoomDto {
  @ApiProperty({ example: 'Series A due diligence', minLength: 1, maxLength: NAME_MAX_LENGTH })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;
}

export class RenameDataRoomDto extends CreateDataRoomDto {}

export class DataRoomDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Series A due diligence' })
  name!: string;

  @ApiProperty({ format: 'uuid' })
  ownerId!: string;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(room: DataRoom): DataRoomDto {
    return {
      id: room.id,
      name: room.name,
      ownerId: room.ownerId,
      createdAt: room.createdAt,
    };
  }
}
