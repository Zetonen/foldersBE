import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';

const UNIQUE_VIOLATION = '23505';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = this.usersRepository.create({
      email: UsersService.normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      name: input.name.trim(),
    });

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: UsersService.normalizeEmail(email) },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }
}
