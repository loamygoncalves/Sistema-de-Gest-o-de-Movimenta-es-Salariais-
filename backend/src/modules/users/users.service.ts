import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findAll() {
    return this.userRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  findByEmailWithPassword(email: string) {
    return this.userRepo.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'passwordHash', 'role', 'directorateId', 'active'],
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Já existe um usuário com este e-mail');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
      directorateId: dto.directorateId,
    });
    return this.userRepo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.findOne(id);
    await this.userRepo.update(id, dto);
    return this.findOne(id);
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    await this.findOne(id);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.userRepo.update(id, { passwordHash });
  }
}
