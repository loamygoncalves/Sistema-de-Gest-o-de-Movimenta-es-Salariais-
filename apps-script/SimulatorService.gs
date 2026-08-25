/**
 * Simulador de impacto financeiro — o módulo mais importante do sistema.
 * Espelha backend/src/modules/simulator/simulator.service.ts, incluindo o
 * formato de entrada desacoplado de um MovementRequest persistido
 * (SimulationInput), usado tanto pelo fluxo oficial de submissão quanto
 * pelo Simulador Rápido (ver api_previewSimulation em Api.gs).
 */

var ChargeParametersService = {
  list: function () {
    return Tables.chargeParameters.all();
  },

  listActive: function () {
    return Tables.chargeParameters.where(function (r) {
      return r.active;
    });
  },

  create: function (input) {
    return Tables.chargeParameters.insert({
      name: input.name,
      label: input.label,
      valueType: input.valueType,
      value: Number(input.value),
      isBenefit: !!input.isBenefit,
      active: true,
      createdAt: nowIso_(),
    });
  },

  update: function (id, input) {
    return Tables.chargeParameters.update(id, input);
  },
};

var SimulatorService = {
  /** Meses restantes no ano-calendário da data efetiva, incluindo o próprio mês (jan=12, dez=1). */
  monthsRemaining_: function (effectiveDateIso) {
    var date = new Date(effectiveDateIso);
    return 13 - (date.getMonth() + 1);
  },

  /** Diferença de salário mensal introduzida pela movimentação. `input` é um SimulationInput. */
  monthlySalaryImpact_: function (input) {
    switch (input.type) {
      case MovementType.PROMOCAO:
        return Number(input.newSalary || 0) - Number(input.currentSalary || 0);
      case MovementType.MERITO:
        return Number(input.currentSalary || 0) * (Number(input.meritPercentage || 0) / 100);
      case MovementType.AUMENTO_QUADRO:
        return Number(input.plannedSalary || 0) * Number(input.quantity || 1);
      default:
        return 0;
    }
  },

  /**
   * Orçamento anual do bucket (diretoria + centro de custo + cargo) exato
   * em que a movimentação recai — a mesma unidade usada em toda comparação
   * orçamento x realizado do sistema (BudgetService.getDashboard,
   * EmployeesService.compareWithBudget). Sem centro de custo/cargo não há
   * como localizar uma linha orçamentária: o orçamento do bucket é zero.
   */
  bucketBudgetAnnual_: function (directorateId, costCenterId, positionId) {
    if (!costCenterId || !positionId) return 0;
    var entries = Tables.budgetEntries.where(function (b) {
      return b.directorateId === directorateId && b.costCenterId === costCenterId && b.positionId === positionId;
    });
    return entries.reduce(function (sum, entry) {
      return sum + sumAllMonths_(entry);
    }, 0);
  },

  /** Folha anualizada (salário mensal x12) dos colaboradores ativos hoje nesse mesmo bucket. */
  bucketCurrentAnnualPayroll_: function (directorateId, costCenterId, positionId) {
    if (!costCenterId || !positionId) return 0;
    var employees = Tables.employees.where(function (e) {
      return (
        e.status === EmployeeStatus.ATIVO &&
        e.directorateId === directorateId &&
        e.costCenterId === costCenterId &&
        e.positionId === positionId
      );
    });
    return sumBy_(employees, 'currentSalary') * 12;
  },

  /**
   * Executa a simulação e retorna o resultado (sem persistir). `input`:
   * {type, directorateId, costCenterId, bucketPositionId, currentSalary,
   * newSalary, meritPercentage, plannedSalary, quantity, effectiveDate}.
   */
  simulate: function (input) {
    var monthsRemaining = this.monthsRemaining_(input.effectiveDate);
    var monthlySalaryImpact = this.monthlySalaryImpact_(input);
    var annualSalaryImpact = monthlySalaryImpact * monthsRemaining;

    var chargeParameters = ChargeParametersService.listActive();
    var chargesTotal = 0;
    var benefitsTotal = 0;
    chargeParameters.forEach(function (param) {
      var amount =
        param.valueType === ChargeValueType.PERCENTUAL
          ? monthlySalaryImpact * (Number(param.value) / 100)
          : Number(param.value);
      if (param.isBenefit) benefitsTotal += amount;
      else chargesTotal += amount;
    });

    var totalMonthlyImpact = monthlySalaryImpact + chargesTotal + benefitsTotal;
    var totalAnnualImpact = totalMonthlyImpact * monthsRemaining;

    var budgetedDirectoratePayroll = this.bucketBudgetAnnual_(input.directorateId, input.costCenterId, input.bucketPositionId);
    var currentDirectoratePayroll = this.bucketCurrentAnnualPayroll_(
      input.directorateId,
      input.costCenterId,
      input.bucketPositionId,
    );

    var payrollAfterApproval = currentDirectoratePayroll + totalAnnualImpact;
    var difference = budgetedDirectoratePayroll - payrollAfterApproval;
    var percentConsumed = budgetedDirectoratePayroll > 0 ? (payrollAfterApproval / budgetedDirectoratePayroll) * 100 : 0;
    var exceedsBudget = payrollAfterApproval > budgetedDirectoratePayroll;

    var alertMessage;
    if (!input.costCenterId || !input.bucketPositionId) {
      alertMessage = 'Não foi possível localizar o centro de custo/cargo para comparar com o orçamento.';
    } else if (exceedsBudget) {
      var excessPercent =
        budgetedDirectoratePayroll > 0
          ? ((payrollAfterApproval - budgetedDirectoratePayroll) / budgetedDirectoratePayroll) * 100
          : 100;
      alertMessage = 'Movimentação excede o orçamento do bucket (diretoria + centro de custo + cargo) em ' + excessPercent.toFixed(1) + '%.';
    } else {
      alertMessage = 'Movimentação aderente ao orçamento.';
    }

    var baseSalary = Number(input.currentSalary || 0);
    var salaryIncreasePercent = baseSalary > 0 ? (monthlySalaryImpact / baseSalary) * 100 : null;
    if (salaryIncreasePercent !== null && salaryIncreasePercent > RULES.MAX_INCREASE_PERCENT_ALERT) {
      alertMessage +=
        ' Atenção: aumento de ' +
        salaryIncreasePercent.toFixed(1) +
        '% ultrapassa o limite de ' +
        RULES.MAX_INCREASE_PERCENT_ALERT +
        '% configurado.';
    }

    return {
      monthsRemaining: monthsRemaining,
      monthlySalaryImpact: monthlySalaryImpact,
      annualSalaryImpact: annualSalaryImpact,
      chargesTotal: chargesTotal,
      benefitsTotal: benefitsTotal,
      totalMonthlyImpact: totalMonthlyImpact,
      totalAnnualImpact: totalAnnualImpact,
      budgetedDirectoratePayroll: budgetedDirectoratePayroll,
      currentDirectoratePayroll: currentDirectoratePayroll,
      payrollAfterApproval: payrollAfterApproval,
      difference: difference,
      percentConsumed: round3_(percentConsumed),
      exceedsBudget: exceedsBudget,
      alertMessage: alertMessage,
      salaryIncreasePercent: salaryIncreasePercent,
    };
  },

  /** Adapta um MovementRequest persistido (aba Movimentacoes) para SimulationInput. */
  simulationInputFromMovement_: function (movement) {
    var bucketPositionId = movement.type === MovementType.MERITO ? movement.currentPositionId : movement.newPositionId;
    return {
      type: movement.type,
      directorateId: movement.directorateId,
      costCenterId: movement.costCenterId,
      bucketPositionId: bucketPositionId,
      currentSalary: movement.currentSalary,
      newSalary: movement.newSalary,
      meritPercentage: movement.meritPercentage,
      plannedSalary: movement.plannedSalary,
      quantity: movement.quantity,
      effectiveDate: movement.effectiveDate,
    };
  },

  /** Executa e persiste a simulação (linha em Simulacoes) para uma movimentação já criada. */
  simulateAndPersist: function (movementId) {
    var movement = MovementsService.getRaw_(movementId);
    var result = this.simulate(this.simulationInputFromMovement_(movement));

    return Tables.movementSimulations.insert({
      movementRequestId: movementId,
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
      createdAt: nowIso_(),
    });
  },

  latestSimulation: function (movementId) {
    var all = Tables.movementSimulations.where(function (s) {
      return s.movementRequestId === movementId;
    });
    if (all.length === 0) return null;
    all.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return all[0];
  },
};

function round3_(value) {
  return Math.round(value * 1000) / 1000;
}
