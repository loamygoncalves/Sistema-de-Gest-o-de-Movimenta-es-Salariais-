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
   * Orçamento anual do centro de custo (diretoria + centro de custo) exato
   * em que a movimentação recai — nunca por cargo: o orçamento é sempre
   * olhado no nível do centro de custo (e da diretoria), a mesma unidade
   * usada em toda comparação orçamento x realizado do sistema
   * (BudgetService.getDashboard, EmployeesService.compareWithBudget). Sem
   * centro de custo não há como localizar uma linha orçamentária: o
   * orçamento é zero.
   */
  bucketBudgetAnnual_: function (directorateId, costCenterId) {
    if (!costCenterId) return 0;
    var entries = Tables.budgetEntries.where(function (b) {
      return b.directorateId === directorateId && b.costCenterId === costCenterId;
    });
    return entries.reduce(function (sum, entry) {
      return sum + sumAllMonths_(entry);
    }, 0);
  },

  /**
   * Folha real acumulada (soma, não anualizada) desse centro de custo em
   * todos os meses já fechados do ano de referência (`year`, o ano da data
   * efetiva da movimentação) — usa exclusivamente a aba FechamentoFolha
   * (payrollSnapshots), nunca employees.currentSalary ao vivo. Também
   * devolve o total do ÚLTIMO mês fechado nesse centro de custo, base para
   * projetar os meses restantes (ver simulate abaixo). Sem nenhum
   * fechamento no ano, tudo vem zerado em vez de herdar o cadastro ou
   * outro ano.
   */
  bucketClosedMonthsPayroll_: function (directorateId, costCenterId, year) {
    if (!costCenterId) return { yearToDatePayroll: 0, lastMonthPayroll: 0 };
    var snapshots = Tables.payrollSnapshots.where(function (s) {
      return Number(s.year) === Number(year) && s.directorateId === directorateId && s.costCenterId === costCenterId;
    });
    if (snapshots.length === 0) return { yearToDatePayroll: 0, lastMonthPayroll: 0 };

    var yearToDatePayroll = sumBy_(snapshots, 'salary');
    var lastClosedMonth = Math.max.apply(
      null,
      snapshots.map(function (s) { return Number(s.month); })
    );
    var lastMonthPayroll = sumBy_(
      snapshots.filter(function (s) { return Number(s.month) === lastClosedMonth; }),
      'salary'
    );

    return { yearToDatePayroll: yearToDatePayroll, lastMonthPayroll: lastMonthPayroll };
  },

  /**
   * Executa a simulação e retorna o resultado (sem persistir). `input`:
   * {type, directorateId, costCenterId, currentSalary, newSalary,
   * meritPercentage, plannedSalary, quantity, effectiveDate}.
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

    var budgetedDirectoratePayroll = this.bucketBudgetAnnual_(input.directorateId, input.costCenterId);
    var effectiveYear = new Date(input.effectiveDate).getFullYear();
    var closedMonths = this.bucketClosedMonthsPayroll_(input.directorateId, input.costCenterId, effectiveYear);
    var currentDirectoratePayroll = closedMonths.yearToDatePayroll;

    // Projeção até dezembro: acumulado real (meses já fechados) + meses que
    // faltam no ano, projetados a partir do último fechamento já com o
    // impacto mensal total da movimentação — não um simples "atual anual +
    // impacto x meses", que ignoraria o histórico real do centro de custo.
    var projectedMonthlyPayroll = closedMonths.lastMonthPayroll + totalMonthlyImpact;
    var projectedRemainingPayroll = projectedMonthlyPayroll * monthsRemaining;
    var payrollAfterApproval = closedMonths.yearToDatePayroll + projectedRemainingPayroll;
    var difference = budgetedDirectoratePayroll - payrollAfterApproval;
    var percentConsumed = budgetedDirectoratePayroll > 0 ? (payrollAfterApproval / budgetedDirectoratePayroll) * 100 : 0;
    var exceedsBudget = payrollAfterApproval > budgetedDirectoratePayroll;

    var alertMessage;
    if (!input.costCenterId) {
      alertMessage = 'Não foi possível localizar o centro de custo para comparar com o orçamento.';
    } else if (exceedsBudget) {
      var excessPercent =
        budgetedDirectoratePayroll > 0
          ? ((payrollAfterApproval - budgetedDirectoratePayroll) / budgetedDirectoratePayroll) * 100
          : 100;
      alertMessage = 'Movimentação excede o orçamento do centro de custo em ' + excessPercent.toFixed(1) + '%.';
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
    return {
      type: movement.type,
      directorateId: movement.directorateId,
      costCenterId: movement.costCenterId,
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
