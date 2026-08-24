/**
 * Simulador de impacto financeiro — o módulo mais importante do sistema.
 * Espelha backend/src/modules/simulator/simulator.service.ts.
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

  monthlySalaryImpact_: function (movement) {
    switch (movement.type) {
      case MovementType.PROMOCAO:
      case MovementType.TRANSFERENCIA:
        return Number(movement.newSalary || 0) - Number(movement.currentSalary || 0);
      case MovementType.MERITO:
        return Number(movement.currentSalary || 0) * (Number(movement.meritPercentage || 0) / 100);
      case MovementType.AUMENTO_QUADRO:
        return Number(movement.plannedSalary || 0) * Number(movement.quantity || 1);
      default:
        return 0;
    }
  },

  /** Executa a simulação e retorna o resultado (sem persistir). */
  simulate: function (movement) {
    var monthsRemaining = this.monthsRemaining_(movement.effectiveDate);
    var monthlySalaryImpact = this.monthlySalaryImpact_(movement);
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

    var directorate = OrgService.getDirectorate(movement.directorateId);
    var budgetedDirectoratePayroll = Number(directorate.annualBudget);

    var activeEmployees = Tables.employees.where(function (e) {
      return e.directorateId === movement.directorateId;
    });
    var currentDirectoratePayroll = sumBy_(activeEmployees, 'currentSalary') * 12;

    var payrollAfterApproval = currentDirectoratePayroll + totalAnnualImpact;
    var difference = budgetedDirectoratePayroll - payrollAfterApproval;
    var percentConsumed = budgetedDirectoratePayroll > 0 ? (payrollAfterApproval / budgetedDirectoratePayroll) * 100 : 0;
    var exceedsBudget = payrollAfterApproval > budgetedDirectoratePayroll;

    var alertMessage;
    if (exceedsBudget) {
      var excessPercent =
        budgetedDirectoratePayroll > 0
          ? ((payrollAfterApproval - budgetedDirectoratePayroll) / budgetedDirectoratePayroll) * 100
          : 100;
      alertMessage = 'Movimentação excede orçamento da diretoria em ' + excessPercent.toFixed(1) + '%.';
    } else {
      alertMessage = 'Movimentação aderente ao orçamento.';
    }

    var baseSalary = Number(movement.currentSalary || 0);
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

  /** Executa e persiste a simulação (linha em Simulacoes). */
  simulateAndPersist: function (movementId) {
    var movement = MovementsService.getRaw_(movementId);
    var result = this.simulate(movement);

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
