import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CostCenter } from '../org/entities/cost-center.entity';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CostCenter)
    private readonly costCenterRepo: Repository<CostCenter>,
  ) {}

  findAll() {
    return this.userRepo.find({ order: { name: 'ASC' }, relations: ['costCenters'] });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['costCenters'] });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  findByEmailWithPassword(email: string) {
    return this.userRepo.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'passwordHash', 'role', 'directorateId', 'active'],
      relations: ['costCenters'],
    });
  }

  private async resolveCostCenters(ids?: string[]): Promise<CostCenter[] | undefined> {
    if (ids === undefined) return undefined;
    if (ids.length === 0) return [];
    return this.costCenterRepo.findBy({ id: In(ids) });
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
      costCenters: await this.resolveCostCenters(dto.costCenterIds),
    });
    const saved = await this.userRepo.save(user);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    const { costCenterIds, ...rest } = dto;
    await this.userRepo.update(id, rest);
    if (costCenterIds !== undefined) {
      user.costCenters = await this.resolveCostCenters(costCenterIds);
      await this.userRepo.save(user);
    }
    return this.findOne(id);
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    await this.findOne(id);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.userRepo.update(id, { passwordHash });
  }
}
