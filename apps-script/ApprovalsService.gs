/**
 * Workflow de aprovação sequencial Diretor → RH Remuneração → Financeiro.
 * Espelha backend/src/modules/approvals/approvals.service.ts.
 */

/**
 * Lazy on purpose — ver o comentário equivalente em Api.gs: código de nível
 * superior roda na ordem alfabética dos arquivos (ApprovalsService.gs vem
 * antes de Enums.gs), então montar este mapa fora de uma função quebraria a
 * primeira execução do projeto com "Cannot read properties of undefined".
 */
function roleToApproverRole_(role) {
  var map = {};
  map[UserRole.DIRETOR] = ApproverRole.DIRETOR;
  map[UserRole.RH_REMUNERACAO] = ApproverRole.RH_REMUNERACAO;
  map[UserRole.FINANCEIRO] = ApproverRole.FINANCEIRO;
  return map[role];
}

var ApprovalsService = {
  createStepsForMovement: function (movementRequestId) {
    var self = this;
    return APPROVAL_WORKFLOW_ORDER.map(function (role, index) {
      return Tables.approvalSteps.insert({
        movementRequestId: movementRequestId,
        stepOrder: index + 1,
        approverRole: role,
        approverEmail: '',
        status: ApprovalStatus.PENDENTE,
        comment: '',
        decidedAt: '',
        createdAt: nowIso_(),
      });
    });
  },

  timeline: function (movementRequestId) {
    var steps = Tables.approvalSteps.where(function (s) {
      return s.movementRequestId === movementRequestId;
    });
    steps.sort(function (a, b) {
      return Number(a.stepOrder) - Number(b.stepOrder);
    });
    return steps;
  },

  /** Etapas pendentes que o usuário atual pode decidir agora. */
  findPending: function (user) {
    var approverRole = roleToApproverRole_(user.role);
    if (!approverRole) return [];

    var movementsById = indexById_(Tables.movementRequests.all());
    var expectedStatus = STATUS_FOR_APPROVER_ROLE[approverRole];

    var steps = Tables.approvalSteps.where(function (s) {
      if (s.status !== ApprovalStatus.PENDENTE) return false;
      if (s.approverRole !== approverRole) return false;
      var movement = movementsById[s.movementRequestId];
      if (!movement || movement.status !== expectedStatus) return false;
      if (user.role === UserRole.DIRETOR && user.directorateId && movement.directorateId !== user.directorateId) {
        return false;
      }
      return true;
    });

    return steps.map(function (s) {
      var copy = shallowCopy_(s);
      copy.movement = movementsById[s.movementRequestId];
      return copy;
    });
  },

  _loadActionableStep: function (stepId, user) {
    var step = Tables.approvalSteps.get(stepId);
    if (!step) throw new Error('Etapa de aprovação não encontrada');
    var movement = MovementsService.getRaw_(step.movementRequestId);

    if (step.status !== ApprovalStatus.PENDENTE) {
      throw new Error('Esta etapa já foi decidida');
    }
    if (movement.status !== STATUS_FOR_APPROVER_ROLE[step.approverRole]) {
      throw new Error('Esta etapa não está ativa no fluxo atual');
    }
    var userApproverRole = roleToApproverRole_(user.role);
    if (user.role !== UserRole.ADMIN && userApproverRole !== step.approverRole) {
      throw new Error('Perfil sem permissão para decidir esta etapa');
    }
    if (
      step.approverRole === ApproverRole.DIRETOR &&
      user.role === UserRole.DIRETOR &&
      user.directorateId !== movement.directorateId
    ) {
      throw new Error('Diretor só pode aprovar movimentações da própria diretoria');
    }

    return { step: step, movement: movement };
  },

  approve: function (stepId, user, comment) {
    var loaded = this._loadActionableStep(stepId, user);
    var step = loaded.step;
    var movement = loaded.movement;

    Tables.approvalSteps.update(step.id, {
      status: ApprovalStatus.APROVADO,
      approverEmail: user.email,
      comment: comment || '',
      decidedAt: nowIso_(),
    });

    var nextStatus = STATUS_AFTER_STEP[step.approverRole];
    Tables.movementRequests.update(movement.id, { status: nextStatus, updatedAt: nowIso_() });

    if (nextStatus === MovementStatus.APROVADO) {
      this._recordHistory(movement);
    }

    recordAudit_(user.email, 'APPROVE', 'movement_requests', movement.id, { step: step.approverRole });
    return Tables.approvalSteps.get(step.id);
  },

  reject: function (stepId, user, comment) {
    var loaded = this._loadActionableStep(stepId, user);
    var step = loaded.step;
    var movement = loaded.movement;

    Tables.approvalSteps.update(step.id, {
      status: ApprovalStatus.REPROVADO,
      approverEmail: user.email,
      comment: comment || '',
      decidedAt: nowIso_(),
    });

    this.timeline(movement.id).forEach(function (s) {
      if (s.id !== step.id && s.status === ApprovalStatus.PENDENTE) {
        Tables.approvalSteps.update(s.id, { status: ApprovalStatus.PULADO });
      }
    });

    Tables.movementRequests.update(movement.id, { status: MovementStatus.REPROVADO, updatedAt: nowIso_() });
    recordAudit_(user.email, 'REJECT', 'movement_requests', movement.id, { step: step.approverRole, comment: comment });
    return Tables.approvalSteps.get(step.id);
  },

  _recordHistory: function (movement) {
    var simulation = SimulatorService.latestSimulation(movement.id);

    Tables.movementHistory.insert({
      movementRequestId: movement.id,
      employeeId: movement.employeeId || '',
      type: movement.type,
      directorateId: movement.directorateId,
      positionId: movement.newPositionId || movement.currentPositionId || '',
      costCenterId: movement.costCenterId || '',
      previousSalary: movement.currentSalary || '',
      newSalary: movement.newSalary || movement.plannedSalary || '',
      effectiveDate: movement.effectiveDate,
      approvedAt: nowIso_(),
      monthlyImpact: simulation ? simulation.totalMonthlyImpact : 0,
      annualImpact: simulation ? simulation.totalAnnualImpact : 0,
      createdAt: nowIso_(),
    });
  },
};
