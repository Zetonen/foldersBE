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

export interface CreateGoogleUserInput {
  email: string;
  name: string;
  googleId: string;
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

    return this.save(user);
  }

  async createFromGoogle(input: CreateGoogleUserInput): Promise<User> {
    const user = this.usersRepository.create({
      email: UsersService.normalizeEmail(input.email),
      passwordHash: null,
      googleId: input.googleId,
      name: input.name.trim(),
    });

    return this.save(user);
  }

  async linkGoogleId(userId: string, googleId: string): Promise<User> {
    await this.usersRepository.update({ id: userId }, { googleId });

    return this.usersRepository.findOneOrFail({ where: { id: userId } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: UsersService.normalizeEmail(email) },
    });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  private async save(user: User): Promise<User> {
    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }
}
