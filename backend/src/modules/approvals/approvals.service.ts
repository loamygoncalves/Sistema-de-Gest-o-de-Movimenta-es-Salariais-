import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  APPROVAL_WORKFLOW_ORDER,
  ApprovalStatus,
  ApproverRole,
  MovementStatus,
  STATUS_TO_APPROVER_ROLE,
  UserRole,
} from '../../common/enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MovementRequest } from '../movements/entities/movement-request.entity';
import { MovementSimulation } from '../movements/entities/movement-simulation.entity';
import { MovementHistory } from '../history/entities/movement-history.entity';
import { ApprovalStep } from './entities/approval-step.entity';

const ROLE_TO_APPROVER_ROLE: Partial<Record<UserRole, ApproverRole>> = {
  [UserRole.DIRETOR]: ApproverRole.DIRETOR,
  [UserRole.RH_REMUNERACAO]: ApproverRole.RH_REMUNERACAO,
  [UserRole.FINANCEIRO]: ApproverRole.FINANCEIRO,
};

const STATUS_AFTER_STEP: Record<ApproverRole, MovementStatus> = {
  [ApproverRole.DIRETOR]: MovementStatus.PENDENTE_RH,
  [ApproverRole.RH_REMUNERACAO]: MovementStatus.PENDENTE_FINANCEIRO,
  [ApproverRole.FINANCEIRO]: MovementStatus.APROVADO,
};

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ApprovalStep)
    private readonly stepRepo: Repository<ApprovalStep>,
    @InjectRepository(MovementRequest)
    private readonly movementRepo: Repository<MovementRequest>,
    @InjectRepository(MovementSimulation)
    private readonly simulationRepo: Repository<MovementSimulation>,
    @InjectRepository(MovementHistory)
    private readonly historyRepo: Repository<MovementHistory>,
  ) {}

  async createStepsForMovement(movementRequestId: string): Promise<ApprovalStep[]> {
    const steps = APPROVAL_WORKFLOW_ORDER.map((role, index) =>
      this.stepRepo.create({
        movementRequestId,
        stepOrder: index + 1,
        approverRole: role,
        status: ApprovalStatus.PENDENTE,
      }),
    );
    return this.stepRepo.save(steps);
  }

  /** DTO alinhado ao que o frontend consome (ver docs/API_CONTRACT.md). */
  private toStepDto(step: ApprovalStep) {
    return {
      id: step.id,
      movementId: step.movementRequestId,
      order: step.stepOrder,
      role: step.approverRole,
      status: step.status,
      approverId: step.approverUserId ?? null,
      approverName: step.approverUser?.name ?? null,
      comment: step.comment ?? null,
      decidedAt: step.decidedAt ?? null,
      createdAt: step.createdAt,
    };
  }

  async findTimeline(movementRequestId: string) {
    const steps = await this.stepRepo.find({
      where: { movementRequestId },
      order: { stepOrder: 'ASC' },
      relations: ['approverUser'],
    });
    return steps.map((step) => this.toStepDto(step));
  }

  async findPending(user: AuthenticatedUser) {
    const approverRole = ROLE_TO_APPROVER_ROLE[user.role];
    if (!approverRole) return [];

    const qb = this.stepRepo
      .createQueryBuilder('step')
      .leftJoinAndSelect('step.movementRequest', 'movement')
      .leftJoinAndSelect('movement.directorate', 'directorate')
      .leftJoinAndSelect('movement.employee', 'employee')
      .where('step.status = :pending', { pending: ApprovalStatus.PENDENTE })
      .andWhere('step.approverRole = :approverRole', { approverRole })
      .andWhere('movement.status = :movementStatus', {
        movementStatus: this.statusForApproverRole(approverRole),
      });

    if (user.role === UserRole.DIRETOR && user.directorateId) {
      qb.andWhere('movement.directorateId = :directorateId', {
        directorateId: user.directorateId,
      });
    }

    const steps = await qb.orderBy('movement.createdAt', 'ASC').getMany();

    const simulations = await Promise.all(
      steps.map((step) =>
        this.simulationRepo.findOne({
          where: { movementRequestId: step.movementRequestId },
          order: { createdAt: 'DESC' },
        }),
      ),
    );

    return steps.map((step, index) => ({
      ...this.toStepDto(step),
      movementType: step.movementRequest.type,
      employeeName: step.movementRequest.employee?.name,
      directorateName: step.movementRequest.directorate?.name,
      effectiveDate: step.movementRequest.effectiveDate,
      totalAnnualImpact: simulations[index]?.totalAnnualImpact ?? null,
    }));
  }

  private statusForApproverRole(role: ApproverRole): MovementStatus {
    const entry = Object.entries(STATUS_TO_APPROVER_ROLE).find(([, r]) => r === role);
    return entry![0] as MovementStatus;
  }

  private async loadActionableStep(stepId: string, user: AuthenticatedUser): Promise<{
    step: ApprovalStep;
    movement: MovementRequest;
  }> {
    const step = await this.stepRepo.findOne({ where: { id: stepId } });
    if (!step) throw new NotFoundException('Etapa de aprovação não encontrada');

    const movement = await this.movementRepo.findOneOrFail({ where: { id: step.movementRequestId } });

    if (step.status !== ApprovalStatus.PENDENTE) {
      throw new ForbiddenException('Esta etapa já foi decidida');
    }
    if (movement.status !== this.statusForApproverRole(step.approverRole)) {
      throw new ForbiddenException('Esta etapa não está ativa no fluxo atual');
    }

    const userApproverRole = ROLE_TO_APPROVER_ROLE[user.role];
    if (user.role !== UserRole.ADMIN && userApproverRole !== step.approverRole) {
      throw new ForbiddenException('Perfil sem permissão para decidir esta etapa');
    }
    if (
      step.approverRole === ApproverRole.DIRETOR &&
      user.role === UserRole.DIRETOR &&
      user.directorateId !== movement.directorateId
    ) {
      throw new ForbiddenException('Diretor só pode aprovar movimentações da própria diretoria');
    }

    return { step, movement };
  }

  async approve(stepId: string, user: AuthenticatedUser, comment?: string): Promise<ApprovalStep> {
    const { step, movement } = await this.loadActionableStep(stepId, user);

    await this.stepRepo.update(step.id, {
      status: ApprovalStatus.APROVADO,
      approverUserId: user.id,
      comment,
      decidedAt: new Date(),
    });

    const nextStatus = STATUS_AFTER_STEP[step.approverRole];
    await this.movementRepo.update(movement.id, { status: nextStatus });

    if (nextStatus === MovementStatus.APROVADO) {
      await this.recordHistory(movement);
    }

    return this.stepRepo.findOneOrFail({ where: { id: step.id } });
  }

  async reject(stepId: string, user: AuthenticatedUser, comment: string): Promise<ApprovalStep> {
    const { step, movement } = await this.loadActionableStep(stepId, user);

    await this.stepRepo.update(step.id, {
      status: ApprovalStatus.REPROVADO,
      approverUserId: user.id,
      comment,
      decidedAt: new Date(),
    });

    await this.stepRepo.update(
      { movementRequestId: movement.id, status: ApprovalStatus.PENDENTE },
      { status: ApprovalStatus.PULADO },
    );

    await this.movementRepo.update(movement.id, { status: MovementStatus.REPROVADO });

    return this.stepRepo.findOneOrFail({ where: { id: step.id } });
  }

  private async recordHistory(movement: MovementRequest): Promise<void> {
    const simulation = await this.simulationRepo.findOne({
      where: { movementRequestId: movement.id },
      order: { createdAt: 'DESC' },
    });

    await this.historyRepo.save(
      this.historyRepo.create({
        movementRequestId: movement.id,
        employeeId: movement.employeeId,
        type: movement.type,
        directorateId: movement.directorateId,
        positionId: movement.newPositionId ?? movement.currentPositionId,
        costCenterId: movement.costCenterId ?? movement.employee?.costCenterId,
        previousSalary: movement.currentSalary,
        newSalary: movement.newSalary ?? movement.plannedSalary,
        effectiveDate: movement.effectiveDate,
        approvedAt: new Date(),
        monthlyImpact: simulation?.totalMonthlyImpact ?? 0,
        annualImpact: simulation?.totalAnnualImpact ?? 0,
      }),
    );
  }
}
