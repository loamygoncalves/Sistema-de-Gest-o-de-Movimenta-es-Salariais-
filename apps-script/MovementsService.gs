/**
 * Solicitações de movimentação — espelha backend/src/modules/movements.
 */

var MovementsService = {
  list: function (filters, scope) {
    filters = filters || {};
    scope = scope || {};

    var items = Tables.movementRequests.where(function (m) {
      if (!matchesAccessScope_(m, scope)) return false;
      if (filters.status && m.status !== filters.status) return false;
      if (filters.type && m.type !== filters.type) return false;
      return true;
    });

    items.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return this._withRelations(items);
  },

  getRaw_: function (id) {
    var m = Tables.movementRequests.get(id);
    if (!m) throw new Error('Movimentação não encontrada: ' + id);
    return m;
  },

  get: function (id) {
    var movement = this._withRelations([this.getRaw_(id)])[0];
    movement.simulation = SimulatorService.latestSimulation(id);
    movement.approvalSteps = ApprovalsService.timeline(id);
    return movement;
  },

  _withRelations: function (movements) {
    var employees = indexById_(Tables.employees.all());
    var directorates = indexById_(Tables.directorates.all());
    var costCenters = indexById_(Tables.costCenters.all());
    var positions = indexById_(Tables.positions.all());
    return movements.map(function (m) {
      var copy = shallowCopy_(m);
      copy.employeeName = m.employeeId && employees[m.employeeId] ? employees[m.employeeId].name : null;
      copy.directorateName = directorates[m.directorateId] ? directorates[m.directorateId].name : null;
      copy.costCenterName = m.costCenterId && costCenters[m.costCenterId] ? costCenters[m.costCenterId].name : null;
      copy.currentPositionName = m.currentPositionId && positions[m.currentPositionId] ? positions[m.currentPositionId].name : null;
      copy.newPositionName = m.newPositionId && positions[m.newPositionId] ? positions[m.newPositionId].name : null;
      return copy;
    });
  },

  create: function (input, user) {
    var employee = input.employeeId ? Tables.employees.get(input.employeeId) : null;
    if (input.employeeId && !employee) throw new Error('Colaborador não encontrado');

    var base = {
      type: input.type,
      status: MovementStatus.RASCUNHO,
      effectiveDate: input.effectiveDate,
      justification: input.justification,
      requestedByEmail: user.email,
      createdAt: nowIso_(),
      updatedAt: nowIso_(),
    };

    if (input.type === MovementType.PROMOCAO) {
      if (!employee) throw new Error('Colaborador é obrigatório para promoção');
      if (!input.newPositionId) throw new Error('Novo cargo é obrigatório');
      if (input.newSalary === undefined || input.newSalary === null) throw new Error('Novo salário é obrigatório');
      if (Number(input.newSalary) < Number(employee.currentSalary)) {
        throw new Error('Promoção não pode ter novo salário inferior ao salário atual do colaborador');
      }
      base.employeeId = employee.id;
      base.directorateId = employee.directorateId;
      base.costCenterId = employee.costCenterId || '';
      base.currentPositionId = employee.positionId;
      base.newPositionId = input.newPositionId;
      base.currentSalary = Number(employee.currentSalary);
      base.newSalary = Number(input.newSalary);
    } else if (input.type === MovementType.MERITO) {
      if (!employee) throw new Error('Colaborador é obrigatório para mérito');
      if (!input.percentage || Number(input.percentage) <= 0) {
        throw new Error('Percentual de mérito deve ser maior que zero');
      }
      base.employeeId = employee.id;
      base.directorateId = employee.directorateId;
      base.costCenterId = employee.costCenterId || '';
      base.currentPositionId = employee.positionId;
      base.currentSalary = Number(employee.currentSalary);
      base.newSalary = round2_(Number(employee.currentSalary) * (1 + Number(input.percentage) / 100));
      base.meritPercentage = Number(input.percentage);
    } else if (input.type === MovementType.AUMENTO_QUADRO) {
      if (!input.directorateId) throw new Error('Diretoria é obrigatória');
      if (!input.costCenterId) throw new Error('Centro de custo é obrigatório');
      if (!input.positionId) throw new Error('Cargo é obrigatório');
      if (!input.quantity || Number(input.quantity) < 1) throw new Error('Quantidade de vagas deve ser maior que zero');
      if (input.plannedSalary === undefined || Number(input.plannedSalary) < 0) {
        throw new Error('Salário previsto é obrigatório');
      }
      base.directorateId = input.directorateId;
      base.costCenterId = input.costCenterId;
      base.newPositionId = input.positionId;
      base.quantity = Number(input.quantity);
      base.plannedSalary = Number(input.plannedSalary);
      base.currentSalary = 0;
    } else {
      throw new Error('Tipo de movimentação inválido: ' + input.type);
    }

    var created = Tables.movementRequests.insert(base);
    return created;
  },

  update: function (id, input) {
    var movement = this.getRaw_(id);
    if (movement.status !== MovementStatus.RASCUNHO) {
      throw new Error('Somente movimentações em rascunho podem ser editadas');
    }
    if (
      movement.type === MovementType.PROMOCAO &&
      input.newSalary !== undefined &&
      Number(input.newSalary) < Number(movement.currentSalary)
    ) {
      throw new Error('Promoção não pode ter novo salário inferior ao salário atual do colaborador');
    }
    input.updatedAt = nowIso_();
    return Tables.movementRequests.update(id, input);
  },

  cancel: function (id) {
    var movement = this.getRaw_(id);
    if (movement.status !== MovementStatus.RASCUNHO) {
      throw new Error('Somente movimentações em rascunho podem ser canceladas');
    }
    return Tables.movementRequests.update(id, { status: MovementStatus.CANCELADO, updatedAt: nowIso_() });
  },

  simulate: function (id) {
    return SimulatorService.simulateAndPersist(id);
  },

  submit: function (id) {
    var movement = this.getRaw_(id);
    if (movement.status !== MovementStatus.RASCUNHO) {
      throw new Error('Somente movimentações em rascunho podem ser submetidas');
    }
    this.simulate(id);
    ApprovalsService.createStepsForMovement(id);
    Tables.movementRequests.update(id, { status: MovementStatus.PENDENTE_DIRETOR, updatedAt: nowIso_() });
    var submitted = this.get(id);
    notifyMovementSubmitted_(submitted);
    return submitted;
  },
};
