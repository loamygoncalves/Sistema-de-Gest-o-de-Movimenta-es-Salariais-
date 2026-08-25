import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination-query.dto';
import { MovementStatus, MovementType } from '../../common/enums';
import { AccessScope, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { applyAccessScope } from '../../common/utils/access-scope.util';
import { Employee } from '../employees/entities/employee.entity';
import { ApprovalsService } from '../approvals/approvals.service';
import { SimulatorService } from '../simulator/simulator.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MovementRequest } from './entities/movement-request.entity';
import { MovementSimulation } from './entities/movement-simulation.entity';
import { CreateMovementDto, MovementQueryDto, UpdateMovementDto } from './dto/movement.dto';

@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(MovementRequest)
    private readonly movementRepo: Repository<MovementRequest>,
    @InjectRepository(MovementSimulation)
    private readonly simulationRepo: Repository<MovementSimulation>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly simulatorService: SimulatorService,
    private readonly approvalsService: ApprovalsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: MovementQueryDto, scope: AccessScope) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.employee', 'employee')
      .leftJoinAndSelect('m.directorate', 'directorate')
      .leftJoinAndSelect('m.costCenter', 'costCenter')
      .leftJoinAndSelect('m.currentPosition', 'currentPosition')
      .leftJoinAndSelect('m.newPosition', 'newPosition')
      .leftJoinAndSelect('m.requestedBy', 'requestedBy');

    applyAccessScope(qb, 'm', scope, query.directorateId, query.costCenterId);
    if (query.status) qb.andWhere('m.status = :status', { status: query.status });
    if (query.type) qb.andWhere('m.type = :type', { type: query.type });

    qb.orderBy('m.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, limit);
  }

  async findOne(id: string): Promise<MovementRequest & { simulation?: MovementSimulation | null }> {
    const movement = await this.movementRepo.findOne({ where: { id } });
    if (!movement) throw new NotFoundException('Movimentação não encontrada');
    const simulation = await this.simulationRepo.findOne({
      where: { movementRequestId: id },
      order: { createdAt: 'DESC' },
    });
    return { ...movement, simulation };
  }

  private async loadMovementOrFail(id: string): Promise<MovementRequest> {
    const movement = await this.movementRepo.findOne({ where: { id } });
    if (!movement) throw new NotFoundException('Movimentação não encontrada');
    return movement;
  }

  async create(dto: CreateMovementDto, user: AuthenticatedUser): Promise<MovementRequest> {
    let employee: Employee | null = null;
    if (dto.employeeId) {
      employee = await this.employeeRepo.findOne({ where: { id: dto.employeeId } });
      if (!employee) throw new BadRequestException('Colaborador não encontrado');
    }

    const base: Partial<MovementRequest> = {
      type: dto.type,
      status: MovementStatus.RASCUNHO,
      effectiveDate: dto.effectiveDate,
      justification: dto.justification,
      requestedById: user.id,
    };

    switch (dto.type) {
      case MovementType.PROMOCAO: {
        if (!employee) throw new BadRequestException('Colaborador é obrigatório para promoção');
        if (!dto.newPositionId) throw new BadRequestException('Novo cargo é obrigatório');
        if (dto.newSalary === undefined) throw new BadRequestException('Novo salário é obrigatório');
        if (dto.newSalary < employee.currentSalary) {
          throw new BadRequestException(
            'Promoção não pode ter novo salário inferior ao salário atual do colaborador',
          );
        }
        Object.assign(base, {
          employeeId: employee.id,
          directorateId: employee.directorateId,
          costCenterId: employee.costCenterId,
          currentPositionId: employee.positionId,
          newPositionId: dto.newPositionId,
          currentSalary: employee.currentSalary,
          newSalary: dto.newSalary,
        });
        break;
      }
      case MovementType.MERITO: {
        if (!employee) throw new BadRequestException('Colaborador é obrigatório para mérito');
        if (dto.percentage === undefined || dto.percentage <= 0) {
          throw new BadRequestException('Percentual de mérito deve ser maior que zero');
        }
        Object.assign(base, {
          employeeId: employee.id,
          directorateId: employee.directorateId,
          costCenterId: employee.costCenterId,
          currentPositionId: employee.positionId,
          currentSalary: employee.currentSalary,
          newSalary: Number((employee.currentSalary * (1 + dto.percentage / 100)).toFixed(2)),
          meritPercentage: dto.percentage,
        });
        break;
      }
      case MovementType.AUMENTO_QUADRO: {
        if (!dto.directorateId) throw new BadRequestException('Diretoria é obrigatória');
        if (!dto.costCenterId) throw new BadRequestException('Centro de custo é obrigatório');
        if (!dto.positionId) throw new BadRequestException('Cargo é obrigatório');
        if (!dto.quantity || dto.quantity < 1) {
          throw new BadRequestException('Quantidade de vagas deve ser maior que zero');
        }
        if (dto.plannedSalary === undefined || dto.plannedSalary < 0) {
          throw new BadRequestException('Salário previsto é obrigatório');
        }
        Object.assign(base, {
          directorateId: dto.directorateId,
          costCenterId: dto.costCenterId,
          newPositionId: dto.positionId,
          quantity: dto.quantity,
          plannedSalary: dto.plannedSalary,
          currentSalary: 0,
        });
        break;
      }
      default:
        throw new BadRequestException('Tipo de movimentação inválido');
    }

    return this.movementRepo.save(this.movementRepo.create(base));
  }

  async update(id: string, dto: UpdateMovementDto): Promise<MovementRequest> {
    const movement = await this.loadMovementOrFail(id);
    if (movement.status !== MovementStatus.RASCUNHO) {
      throw new ForbiddenException('Somente movimentações em rascunho podem ser editadas');
    }

    if (
      movement.type === MovementType.PROMOCAO &&
      dto.newSalary !== undefined &&
      movement.currentSalary !== undefined &&
      dto.newSalary < movement.currentSalary
    ) {
      throw new BadRequestException(
        'Promoção não pode ter novo salário inferior ao salário atual do colaborador',
      );
    }

    await this.movementRepo.update(id, dto as any);
    return this.loadMovementOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const movement = await this.loadMovementOrFail(id);
    if (movement.status !== MovementStatus.RASCUNHO) {
      throw new ForbiddenException('Somente movimentações em rascunho podem ser canceladas');
    }
    await this.movementRepo.update(id, { status: MovementStatus.CANCELADO });
  }

  async simulate(id: string): Promise<MovementSimulation> {
    const movement = await this.loadMovementOrFail(id);
    const result = await this.simulatorService.simulateMovement(movement);

    const simulation = this.simulationRepo.create({
      movementRequestId: id,
      monthsRemaining: result.monthsRemaining,
      monthlySalaryImpact: result.monthlySalaryImpact,
      annualSalaryImpact: result.annualSalaryImpact,
      chargesTotal: result.chargesTotal,
      benefitsTotal: result.benefitsTotal,
      totalMonthlyImpact: result.totalMonthlyImpact,
      totalAnnualImpact: result.totalAnnualImpact,
      budgetedDirectoratePayroll: result.budgetedDirectoratePayroll,
      currentDirectoratePayroll: result.currentDirectoratePayroll,
      payrollAfterApproval: result.payrollAfterApproval,
      difference: result.difference,
      percentConsumed: result.percentConsumed,
      exceedsBudget: result.exceedsBudget,
      alertMessage: result.alertMessage,
    });

    return this.simulationRepo.save(simulation);
  }

  async submit(id: string): Promise<MovementRequest> {
    const movement = await this.loadMovementOrFail(id);
    if (movement.status !== MovementStatus.RASCUNHO) {
      throw new ForbiddenException('Somente movimentações em rascunho podem ser submetidas');
    }

    await this.simulate(id);
    await this.approvalsService.createStepsForMovement(id);
    await this.movementRepo.update(id, { status: MovementStatus.PENDENTE_APROVACAO });

    const submitted = await this.loadMovementOrFail(id);
    await this.notificationsService.notifyMovementSubmitted(submitted);
    return submitted;
  }
}
