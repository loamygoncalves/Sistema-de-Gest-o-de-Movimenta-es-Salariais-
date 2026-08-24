import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChargeParameter } from './entities/charge-parameter.entity';
import { CreateChargeParameterDto, UpdateChargeParameterDto } from './dto/charge-parameter.dto';

@Injectable()
export class ChargeParametersService {
  constructor(
    @InjectRepository(ChargeParameter)
    private readonly repo: Repository<ChargeParameter>,
  ) {}

  findAll() {
    return this.repo.find({ order: { isBenefit: 'ASC', label: 'ASC' } });
  }

  findAllActive() {
    return this.repo.find({ where: { active: true } });
  }

  create(dto: CreateChargeParameterDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateChargeParameterDto) {
    await this.repo.update(id, dto);
    return this.repo.findOneOrFail({ where: { id } });
  }
}
