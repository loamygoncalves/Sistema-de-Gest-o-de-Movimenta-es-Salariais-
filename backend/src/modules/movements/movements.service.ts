import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination-query.dto';
import { MovementStatus, MovementType, UserRole } from '../../common/enums';
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
        if (dto.newSalary === undefined) throw new BadRequestException('Novo salário é obrigatório');
        if (dto.newSalary <= employee.currentSalary) {
          throw new BadRequestException(
            'Mérito precisa ter novo salário maior que o salário atual do colaborador',
          );
        }
        const meritPercentage = ((dto.newSalary - employee.currentSalary) / employee.currentSalary) * 100;
        Object.assign(base, {
          employeeId: employee.id,
          directorateId: employee.directorateId,
          costCenterId: employee.costCenterId,
          currentPositionId: employee.positionId,
          currentSalary: employee.currentSalary,
          newSalary: dto.newSalary,
          meritPercentage: Number(meritPercentage.toFixed(2)),
        });
        break;
      }
      case MovementType.AUMENTO_QUADRO: {
        if (!dto.directorateId) throw new BadRequestException('Diretoria é obrigatória');
        if (!dto.costCenterId) throw new BadRequestException('Centro de resultado é obrigatório');
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

  /**
   * Edita uma movimentação já criada — o próprio rascunho ou uma devolvida
   * (RASCUNHO/DEVOLVIDO, sem restrição de perfil, comportamento original)
   * ou, só ADMIN/RH_REMUNERACAO, uma solicitação já em aprovação
   * (PENDENTE_APROVACAO) que precise de correção antes de decidida (ver
   * ApprovalsController). Nunca muda type/employeeId — só os campos
   * específicos do tipo, iguais aos aceitos na criação. Reedita a
   * movimentação PENDENTE_APROVACAO sempre reroda a simulação
   * (this.simulate) para a fila de aprovação nunca mostrar números
   * defasados em relação ao que foi editado.
   */
  async update(id: string, dto: UpdateMovementDto, user: AuthenticatedUser): Promise<MovementRequest> {
    const movement = await this.loadMovementOrFail(id);
    const isPending = movement.status === MovementStatus.PENDENTE_APROVACAO;
    const isEditableFreely =
      movement.status === MovementStatus.RASCUNHO || movement.status === MovementStatus.DEVOLVIDO;
    if (!isEditableFreely && !isPending) {
      throw new ForbiddenException(
        'Somente movimentações em rascunho, devolvidas ou pendentes de aprovação podem ser editadas',
      );
    }
    if (isPending && ![UserRole.ADMIN, UserRole.RH_REMUNERACAO].includes(user.role)) {
      throw new ForbiddenException(
        'Só Administrador ou RH Remuneração podem editar uma movimentação já em aprovação',
      );
    }

    const patch: Partial<MovementRequest> = {
      effectiveDate: dto.effectiveDate ?? movement.effectiveDate,
      justification: dto.justification ?? movement.justification,
    };

    switch (movement.type) {
      case MovementType.PROMOCAO: {
        const newSalary = dto.newSalary ?? movement.newSalary;
        if (newSalary !== undefined && movement.currentSalary !== undefined && newSalary < movement.currentSalary) {
          throw new BadRequestException(
            'Promoção não pode ter novo salário inferior ao salário atual do colaborador',
          );
        }
        Object.assign(patch, {
          newPositionId: dto.newPositionId ?? movement.newPositionId,
          newSalary,
        });
        break;
      }
      case MovementType.MERITO: {
        const newSalary = dto.newSalary ?? movement.newSalary;
        if (newSalary !== undefined && movement.currentSalary !== undefined && newSalary <= movement.currentSalary) {
          throw new BadRequestException(
            'Mérito precisa ter novo salário maior que o salário atual do colaborador',
          );
        }
        const meritPercentage =
          newSalary !== undefined && movement.currentSalary
            ? Number((((newSalary - movement.currentSalary) / movement.currentSalary) * 100).toFixed(2))
            : movement.meritPercentage;
        Object.assign(patch, { newSalary, meritPercentage });
        break;
      }
      case MovementType.AUMENTO_QUADRO: {
        const quantity = dto.quantity ?? movement.quantity;
        if (!quantity || quantity < 1) {
          throw new BadRequestException('Quantidade de vagas deve ser maior que zero');
        }
        const plannedSalary = dto.plannedSalary ?? movement.plannedSalary;
        if (plannedSalary === undefined || plannedSalary < 0) {
          throw new BadRequestException('Salário previsto é obrigatório');
        }
        Object.assign(patch, {
          directorateId: dto.directorateId ?? movement.directorateId,
          costCenterId: dto.costCenterId ?? movement.costCenterId,
          newPositionId: dto.positionId ?? movement.newPositionId,
          quantity,
          plannedSalary,
        });
        break;
      }
    }

    await this.movementRepo.update(id, patch);
    if (isPending) await this.simulate(id);
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
      policyViolations: result.policyViolations,
    });

    return this.simulationRepo.save(simulation);
  }

  /**
   * Submete um RASCUNHO para aprovação, ou reenvia um DEVOLVIDO — mesma
   * ação nos dois casos (o solicitante editou ou não, ver update()), mas
   * para DEVOLVIDO primeiro apaga as etapas da rodada anterior (já
   * decididas/puladas) antes de criar as novas, reiniciando o fluxo de
   * aprovação do zero (ver ApprovalsService#clearStepsForMovement).
   */
  async submit(id: string): Promise<MovementRequest> {
    const movement = await this.loadMovementOrFail(id);
    if (movement.status !== MovementStatus.RASCUNHO && movement.status !== MovementStatus.DEVOLVIDO) {
      throw new ForbiddenException('Somente movimentações em rascunho ou devolvidas podem ser submetidas');
    }
    if (movement.status === MovementStatus.DEVOLVIDO) {
      await this.approvalsService.clearStepsForMovement(id);
    }

    await this.simulate(id);
    await this.approvalsService.createStepsForMovement(id);
    await this.movementRepo.update(id, { status: MovementStatus.PENDENTE_APROVACAO });

    const submitted = await this.loadMovementOrFail(id);
    await this.notificationsService.notifyMovementSubmitted(submitted);
    return submitted;
  }
}
