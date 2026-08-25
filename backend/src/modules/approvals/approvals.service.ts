import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ApprovalStatus, MovementStatus, UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MovementRequest } from '../movements/entities/movement-request.entity';
import { MovementSimulation } from '../movements/entities/movement-simulation.entity';
import { MovementHistory } from '../history/entities/movement-history.entity';
import { ApprovalStep } from './entities/approval-step.entity';
import { ApprovalWorkflowStep } from './entities/approval-workflow-step.entity';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ApprovalStep)
    private readonly stepRepo: Repository<ApprovalStep>,
    @InjectRepository(ApprovalWorkflowStep)
    private readonly workflowStepRepo: Repository<ApprovalWorkflowStep>,
    @InjectRepository(MovementRequest)
    private readonly movementRepo: Repository<MovementRequest>,
    @InjectRepository(MovementSimulation)
    private readonly simulationRepo: Repository<MovementSimulation>,
    @InjectRepository(MovementHistory)
    private readonly historyRepo: Repository<MovementHistory>,
  ) {}

  /** Cria uma ApprovalStep por etapa configurada em ApprovalWorkflowStep, na ordem cadastrada. */
  async createStepsForMovement(movementRequestId: string): Promise<ApprovalStep[]> {
    const workflow = await this.workflowStepRepo.find({ order: { stepOrder: 'ASC' } });
    if (workflow.length === 0) {
      throw new ForbiddenException(
        'Nenhum fluxo de aprovação configurado — cadastre em Administração > Fluxo de Aprovação antes de submeter.',
      );
    }

    const steps = workflow.map((configStep) =>
      this.stepRepo.create({
        movementRequestId,
        stepOrder: configStep.stepOrder,
        eligibleRoles: configStep.roles,
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
      eligibleRoles: step.eligibleRoles,
      decidedByRole: step.decidedByRole ?? null,
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

  /**
   * Etapas pendentes que o usuário atual pode decidir agora: a de menor
   * `stepOrder` ainda PENDENTE de cada movimentação (etapas seguintes só
   * ficam "ativas" depois que as anteriores forem decididas) cujo conjunto
   * de perfis elegíveis inclui o perfil do usuário. GESTOR nunca aprova —
   * só solicita.
   */
  async findPending(user: AuthenticatedUser) {
    if (user.role === UserRole.GESTOR) return [];

    const qb = this.stepRepo
      .createQueryBuilder('step')
      .leftJoinAndSelect('step.movementRequest', 'movement')
      .leftJoinAndSelect('movement.directorate', 'directorate')
      .leftJoinAndSelect('movement.employee', 'employee')
      .where('step.status = :pending', { pending: ApprovalStatus.PENDENTE })
      .andWhere('movement.status = :movementStatus', { movementStatus: MovementStatus.PENDENTE_APROVACAO })
      .andWhere(':role = ANY(step.eligibleRoles)', { role: user.role })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM approval_steps earlier
          WHERE earlier.movement_request_id = step.movement_request_id
            AND earlier.step_order < step.step_order
            AND earlier.status = :pendingInner
        )`,
        { pendingInner: ApprovalStatus.PENDENTE },
      );

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

  private async loadActionableStep(
    stepId: string,
    user: AuthenticatedUser,
  ): Promise<{ step: ApprovalStep; movement: MovementRequest }> {
    const step = await this.stepRepo.findOne({ where: { id: stepId } });
    if (!step) throw new NotFoundException('Etapa de aprovação não encontrada');

    const movement = await this.movementRepo.findOneOrFail({ where: { id: step.movementRequestId } });

    if (step.status !== ApprovalStatus.PENDENTE) {
      throw new ForbiddenException('Esta etapa já foi decidida');
    }
    if (movement.status !== MovementStatus.PENDENTE_APROVACAO) {
      throw new ForbiddenException('Esta etapa não está ativa no fluxo atual');
    }

    const earlierPending = await this.stepRepo.count({
      where: {
        movementRequestId: movement.id,
        stepOrder: LessThan(step.stepOrder),
        status: ApprovalStatus.PENDENTE,
      },
    });
    if (earlierPending > 0) {
      throw new ForbiddenException('Esta etapa não está ativa no fluxo atual');
    }

    if (user.role !== UserRole.ADMIN && !step.eligibleRoles.includes(user.role)) {
      throw new ForbiddenException('Perfil sem permissão para decidir esta etapa');
    }
    if (user.role === UserRole.DIRETOR && user.directorateId && user.directorateId !== movement.directorateId) {
      throw new ForbiddenException('Diretor só pode aprovar movimentações da própria diretoria');
    }

    return { step, movement };
  }

  async approve(stepId: string, user: AuthenticatedUser, comment?: string): Promise<ApprovalStep> {
    const { step, movement } = await this.loadActionableStep(stepId, user);

    await this.stepRepo.update(step.id, {
      status: ApprovalStatus.APROVADO,
      approverUserId: user.id,
      decidedByRole: user.role,
      comment,
      decidedAt: new Date(),
    });

    const remaining = await this.stepRepo.count({
      where: { movementRequestId: movement.id, status: ApprovalStatus.PENDENTE },
    });
    if (remaining === 0) {
      await this.movementRepo.update(movement.id, { status: MovementStatus.APROVADO });
      await this.recordHistory(movement);
    }

    return this.stepRepo.findOneOrFail({ where: { id: step.id } });
  }

  async reject(stepId: string, user: AuthenticatedUser, comment: string): Promise<ApprovalStep> {
    const { step, movement } = await this.loadActionableStep(stepId, user);

    await this.stepRepo.update(step.id, {
      status: ApprovalStatus.REPROVADO,
      approverUserId: user.id,
      decidedByRole: user.role,
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
