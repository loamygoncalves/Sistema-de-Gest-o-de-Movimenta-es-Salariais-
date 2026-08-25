/**
 * Fluxo de aprovação configurável — uma sequência de etapas cadastradas em
 * ApprovalWorkflowSteps (aba FluxoAprovacao), cada uma com um conjunto de
 * perfis elegíveis (qualquer um deles decide, o que agir primeiro). Espelha
 * backend/src/modules/approvals/approvals.service.ts e
 * approval-workflow.service.ts.
 */

/** "RH_REMUNERACAO,ADMIN" -> ["RH_REMUNERACAO","ADMIN"] */
function parseRoles_(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });
}

/** ["RH_REMUNERACAO","ADMIN"] -> "RH_REMUNERACAO,ADMIN" */
function rolesToCsv_(roles) {
  return (roles || []).filter(function (r) { return r; }).join(',');
}

var ApprovalWorkflowService = {
  list: function () {
    var steps = Tables.approvalWorkflowSteps.all().map(function (s) {
      var copy = shallowCopy_(s);
      copy.roles = parseRoles_(s.roles);
      copy.stepOrder = Number(s.stepOrder);
      return copy;
    });
    steps.sort(function (a, b) { return a.stepOrder - b.stepOrder; });
    return steps;
  },

  /**
   * Substitui o fluxo inteiro — não há edição de uma etapa isolada, a ordem
   * do array define stepOrder. Movimentações já submetidas não são afetadas
   * (cada ApprovalStep guarda o snapshot dos perfis elegíveis no momento da
   * submissão).
   */
  replace: function (steps) {
    if (!steps || steps.length === 0) {
      throw new Error('O fluxo de aprovação precisa ter ao menos uma etapa.');
    }
    steps.forEach(function (s) {
      if (!s.roles || s.roles.length === 0) {
        throw new Error('Toda etapa precisa de ao menos um perfil elegível.');
      }
    });

    Tables.approvalWorkflowSteps.all().forEach(function (s) {
      Tables.approvalWorkflowSteps.remove(s.id);
    });

    var now = nowIso_();
    steps.forEach(function (s, index) {
      Tables.approvalWorkflowSteps.insert({
        stepOrder: index + 1,
        roles: rolesToCsv_(s.roles),
        createdAt: now,
        updatedAt: now,
      });
    });

    return this.list();
  },
};

var ApprovalsService = {
  /** Cria uma ApprovalStep por etapa configurada em ApprovalWorkflowSteps, na ordem cadastrada. */
  createStepsForMovement: function (movementRequestId) {
    var workflow = ApprovalWorkflowService.list();
    if (workflow.length === 0) {
      throw new Error(
        'Nenhum fluxo de aprovação configurado — cadastre em Administração > Fluxo de Aprovação antes de submeter.',
      );
    }

    return workflow.map(function (configStep) {
      return Tables.approvalSteps.insert({
        movementRequestId: movementRequestId,
        stepOrder: configStep.stepOrder,
        eligibleRoles: rolesToCsv_(configStep.roles),
        decidedByRole: '',
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
    return steps.map(function (s) {
      var copy = shallowCopy_(s);
      copy.eligibleRoles = parseRoles_(s.eligibleRoles);
      return copy;
    });
  },

  /**
   * Etapas pendentes que o usuário atual pode decidir agora: a de menor
   * stepOrder ainda PENDENTE de cada movimentação (etapas seguintes só
   * ficam "ativas" depois que as anteriores forem decididas) cujo conjunto
   * de perfis elegíveis inclui o perfil do usuário. GESTOR nunca aprova —
   * só solicita.
   */
  findPending: function (user) {
    if (user.role === UserRole.GESTOR) return [];

    var movementsById = indexById_(Tables.movementRequests.all());
    var allSteps = Tables.approvalSteps.all();

    var earliestPendingByMovement = {};
    allSteps.forEach(function (s) {
      if (s.status !== ApprovalStatus.PENDENTE) return;
      var order = Number(s.stepOrder);
      var current = earliestPendingByMovement[s.movementRequestId];
      if (current === undefined || order < current) {
        earliestPendingByMovement[s.movementRequestId] = order;
      }
    });

    var steps = allSteps.filter(function (s) {
      if (s.status !== ApprovalStatus.PENDENTE) return false;
      var movement = movementsById[s.movementRequestId];
      if (!movement || movement.status !== MovementStatus.PENDENTE_APROVACAO) return false;
      if (Number(s.stepOrder) !== earliestPendingByMovement[s.movementRequestId]) return false;
      var eligibleRoles = parseRoles_(s.eligibleRoles);
      if (eligibleRoles.indexOf(user.role) === -1) return false;
      if (user.role === UserRole.DIRETOR && user.directorateId && movement.directorateId !== user.directorateId) {
        return false;
      }
      return true;
    });

    return steps.map(function (s) {
      var copy = shallowCopy_(s);
      copy.eligibleRoles = parseRoles_(s.eligibleRoles);
      copy.movement = movementsById[s.movementRequestId];
      return copy;
    });
  },

  _loadActionableStep: function (stepId, user) {
    var step = Tables.approvalSteps.get(stepId);
    if (!step) throw new Error('Etapa de aprovação não encontrada');
    var movement = MovementsService.getRaw_(step.movementRequestId);
    var eligibleRoles = parseRoles_(step.eligibleRoles);

    if (step.status !== ApprovalStatus.PENDENTE) {
      throw new Error('Esta etapa já foi decidida');
    }
    if (movement.status !== MovementStatus.PENDENTE_APROVACAO) {
      throw new Error('Esta etapa não está ativa no fluxo atual');
    }

    var earlierPending = Tables.approvalSteps.where(function (s) {
      return (
        s.movementRequestId === movement.id &&
        Number(s.stepOrder) < Number(step.stepOrder) &&
        s.status === ApprovalStatus.PENDENTE
      );
    });
    if (earlierPending.length > 0) {
      throw new Error('Esta etapa não está ativa no fluxo atual');
    }

    if (user.role !== UserRole.ADMIN && eligibleRoles.indexOf(user.role) === -1) {
      throw new Error('Perfil sem permissão para decidir esta etapa');
    }
    if (user.role === UserRole.DIRETOR && user.directorateId && user.directorateId !== movement.directorateId) {
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
      decidedByRole: user.role,
      approverEmail: user.email,
      comment: comment || '',
      decidedAt: nowIso_(),
    });

    var remaining = Tables.approvalSteps.where(function (s) {
      return s.movementRequestId === movement.id && s.status === ApprovalStatus.PENDENTE;
    });
    if (remaining.length === 0) {
      Tables.movementRequests.update(movement.id, { status: MovementStatus.APROVADO, updatedAt: nowIso_() });
      this._recordHistory(movement);
    }

    recordAudit_(user.email, 'APPROVE', 'movement_requests', movement.id, { step: step.stepOrder, role: user.role });
    return Tables.approvalSteps.get(step.id);
  },

  reject: function (stepId, user, comment) {
    var loaded = this._loadActionableStep(stepId, user);
    var step = loaded.step;
    var movement = loaded.movement;

    Tables.approvalSteps.update(step.id, {
      status: ApprovalStatus.REPROVADO,
      decidedByRole: user.role,
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
    recordAudit_(user.email, 'REJECT', 'movement_requests', movement.id, { step: step.stepOrder, comment: comment });
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
