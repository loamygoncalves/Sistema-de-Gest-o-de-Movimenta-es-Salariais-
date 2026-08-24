import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Directorate } from './entities/directorate.entity';
import { Management } from './entities/management.entity';
import { Coordination } from './entities/coordination.entity';
import { Position } from './entities/position.entity';
import { CostCenter } from './entities/cost-center.entity';
import {
  CreateCoordinationDto,
  CreateCostCenterDto,
  CreateDirectorateDto,
  CreateManagementDto,
  CreatePositionDto,
  UpdateDirectorateDto,
  UpdatePositionDto,
} from './dto/org.dto';

@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(Directorate)
    private readonly directorateRepo: Repository<Directorate>,
    @InjectRepository(Management)
    private readonly managementRepo: Repository<Management>,
    @InjectRepository(Coordination)
    private readonly coordinationRepo: Repository<Coordination>,
    @InjectRepository(Position)
    private readonly positionRepo: Repository<Position>,
    @InjectRepository(CostCenter)
    private readonly costCenterRepo: Repository<CostCenter>,
  ) {}

  // Diretorias
  findAllDirectorates() {
    return this.directorateRepo.find({ order: { name: 'ASC' } });
  }

  findDirectorate(id: string) {
    return this.directorateRepo.findOneOrFail({ where: { id } });
  }

  createDirectorate(dto: CreateDirectorateDto) {
    return this.directorateRepo.save(this.directorateRepo.create(dto));
  }

  async updateDirectorate(id: string, dto: UpdateDirectorateDto) {
    await this.directorateRepo.update(id, dto);
    return this.findDirectorate(id);
  }

  async removeDirectorate(id: string) {
    await this.directorateRepo.update(id, { active: false });
  }

  // Gerências
  findManagements(directorateId?: string) {
    return this.managementRepo.find({
      where: directorateId ? { directorateId } : {},
      order: { name: 'ASC' },
    });
  }

  createManagement(dto: CreateManagementDto) {
    return this.managementRepo.save(this.managementRepo.create(dto));
  }

  // Coordenações
  findCoordinations(managementId?: string) {
    return this.coordinationRepo.find({
      where: managementId ? { managementId } : {},
      order: { name: 'ASC' },
    });
  }

  createCoordination(dto: CreateCoordinationDto) {
    return this.coordinationRepo.save(this.coordinationRepo.create(dto));
  }

  // Cargos
  findAllPositions() {
    return this.positionRepo.find({ order: { name: 'ASC' } });
  }

  findPosition(id: string) {
    return this.positionRepo.findOneOrFail({ where: { id } });
  }

  findPositionByName(name: string) {
    return this.positionRepo.findOne({ where: { name } });
  }

  createPosition(dto: CreatePositionDto) {
    return this.positionRepo.save(this.positionRepo.create(dto));
  }

  async updatePosition(id: string, dto: UpdatePositionDto) {
    await this.positionRepo.update(id, dto);
    return this.findPosition(id);
  }

  async removePosition(id: string) {
    await this.positionRepo.update(id, { active: false });
  }

  // Centros de custo
  findAllCostCenters() {
    return this.costCenterRepo.find({ order: { name: 'ASC' } });
  }

  createCostCenter(dto: CreateCostCenterDto) {
    return this.costCenterRepo.save(this.costCenterRepo.create(dto));
  }

  findDirectorateByName(name: string) {
    return this.directorateRepo.findOne({ where: { name } });
  }

  findCostCenterByName(name: string) {
    return this.costCenterRepo.findOne({ where: { name } });
  }
}
