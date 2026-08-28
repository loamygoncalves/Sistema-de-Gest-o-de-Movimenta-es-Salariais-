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

/**
 * Junta/separa a lista de mensagens de violação em uma única célula da aba
 * Simulacoes — usa quebra de linha (não vírgula) porque as mensagens são
 * frases livres que podem conter vírgula.
 */
function serializePolicyViolations_(violations) {
  return (violations || []).join('\n');
}

function parsePolicyViolations_(raw) {
  if (!raw) return [];
  return String(raw)
    .split('\n')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });
}

/**
 * Política de Remuneração (tela ADMIN/RH_REMUNERACAO, aba PoliticaRemuneracao)
 * — uma única linha (singleton). Espelha
 * backend/src/modules/simulator/remuneration-policy.service.ts.
 */
var RemunerationPolicyService = {
  get: function () {
    var row = Tables.remunerationPolicies.all()[0];
    return {
      maxMeritPercent: row && row.maxMeritPercent !== '' ? Number(row.maxMeritPercent) : null,
      maxPromotionPercent: row && row.maxPromotionPercent !== '' ? Number(row.maxPromotionPercent) : null,
      minMonthsBetweenRaises: row && row.minMonthsBetweenRaises !== '' ? Number(row.minMonthsBetweenRaises) : null,
    };
  },

  save: function (input) {
    var row = Tables.remunerationPolicies.all()[0];
    var patch = {
      maxMeritPercent: input.maxMeritPercent === null || input.maxMeritPercent === undefined ? null : Number(input.maxMeritPercent),
      maxPromotionPercent:
        input.maxPromotionPercent === null || input.maxPromotionPercent === undefined ? null : Number(input.maxPromotionPercent),
      minMonthsBetweenRaises:
        input.minMonthsBetweenRaises === null || input.minMonthsBetweenRaises === undefined ? null : Number(input.minMonthsBetweenRaises),
      updatedAt: nowIso_(),
    };
    if (row) {
      Tables.remunerationPolicies.update(row.id, patch);
    } else {
      Tables.remunerationPolicies.insert(patch);
    }
    return this.get();
  },
};

var SimulatorService = {
  /**
   * Extrai {year, month} de uma data `YYYY-MM-DD` direto da string, sem
   * passar por `new Date(...).getMonth()/getFullYear()`: uma string
   * date-only é interpretada como meia-noite UTC pelo `Date`, então com o
   * timezone do projeto Apps Script atrás de UTC (ex.: America/Sao_Paulo,
   * UTC-3) os getters locais devolveriam o dia/mês anterior — 01/09
   * "viraria" 31/08 e a movimentação seria contada a partir de agosto em
   * vez de setembro.
   */
  parseIsoDateParts_: function (isoDate) {
    var parts = String(isoDate).split('-').map(Number);
    return { year: parts[0], month: parts[1] };
  },

  /** Meses restantes no ano-calendário da data efetiva, incluindo o próprio mês (jan=12, dez=1). */
  monthsRemaining_: function (effectiveDateIso) {
    var month = this.parseIsoDateParts_(effectiveDateIso).month;
    return 13 - month;
  },

  /** Diferença de salário mensal introduzida pela movimentação. `input` é um SimulationInput. */
  monthlySalaryImpact_: function (input) {
    switch (input.type) {
      case MovementType.PROMOCAO:
      case MovementType.MERITO:
        return Number(input.newSalary || 0) - Number(input.currentSalary || 0);
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
  bucketBudgetAnnual_: function (directorateId, costCenterId, year) {
    if (!costCenterId) return 0;
    var entries = Tables.budgetEntries.where(function (b) {
      return b.directorateId === directorateId && b.costCenterId === costCenterId;
    });
    var factor = BudgetService.getAdjustmentFactor_(year);
    return entries.reduce(function (sum, entry) {
      return sum + sumAllMonths_(entry);
    }, 0) * factor;
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
    if (!costCenterId) return { yearToDatePayroll: 0, lastMonthPayroll: 0, lastClosedMonth: null };
    var snapshots = Tables.payrollSnapshots.where(function (s) {
      return Number(s.year) === Number(year) && s.directorateId === directorateId && s.costCenterId === costCenterId;
    });
    if (snapshots.length === 0) return { yearToDatePayroll: 0, lastMonthPayroll: 0, lastClosedMonth: null };

    var yearToDatePayroll = sumBy_(snapshots, 'salary');
    var lastClosedMonth = Math.max.apply(
      null,
      snapshots.map(function (s) { return Number(s.month); })
    );
    var lastMonthPayroll = sumBy_(
      snapshots.filter(function (s) { return Number(s.month) === lastClosedMonth; }),
      'salary'
    );

    return { yearToDatePayroll: yearToDatePayroll, lastMonthPayroll: lastMonthPayroll, lastClosedMonth: lastClosedMonth };
  },

  /**
   * Política de Remuneração (tela ADMIN/RH_REMUNERACAO): nunca bloqueia a
   * simulação/submissão, só devolve mensagens de violação para sinalizar
   * tanto quem simula quanto quem vai aprovar. Só se aplica a Mérito/
   * Promoção (Aumento de Quadro não reajusta um colaborador existente).
   * Limites não configurados (null) não geram violação.
   */
  checkPolicyViolations_: function (input, salaryIncreasePercent) {
    if (input.type !== MovementType.MERITO && input.type !== MovementType.PROMOCAO) return [];

    var policy = RemunerationPolicyService.get();
    var violations = [];

    if (salaryIncreasePercent !== null) {
      if (input.type === MovementType.MERITO && policy.maxMeritPercent !== null && salaryIncreasePercent > policy.maxMeritPercent) {
        violations.push(
          'Reajuste de ' + salaryIncreasePercent.toFixed(1) + '% ultrapassa o máximo de ' +
            policy.maxMeritPercent + '% da Política de Remuneração para Mérito.'
        );
      }
      if (
        input.type === MovementType.PROMOCAO &&
        policy.maxPromotionPercent !== null &&
        salaryIncreasePercent > policy.maxPromotionPercent
      ) {
        violations.push(
          'Reajuste de ' + salaryIncreasePercent.toFixed(1) + '% ultrapassa o máximo de ' +
            policy.maxPromotionPercent + '% da Política de Remuneração para Promoção.'
        );
      }
    }

    if (policy.minMonthsBetweenRaises !== null && input.employeeId) {
      var priorRaises = Tables.movementHistory.where(function (h) {
        return h.employeeId === input.employeeId && (h.type === MovementType.MERITO || h.type === MovementType.PROMOCAO);
      });
      if (priorRaises.length > 0) {
        priorRaises.sort(function (a, b) { return new Date(b.effectiveDate) - new Date(a.effectiveDate); });
        var lastRaise = priorRaises[0];
        var last = this.parseIsoDateParts_(lastRaise.effectiveDate);
        var current = this.parseIsoDateParts_(input.effectiveDate);
        var monthsSinceLastRaise = (current.year - last.year) * 12 + (current.month - last.month);
        if (monthsSinceLastRaise < policy.minMonthsBetweenRaises) {
          violations.push(
            'Último reajuste desse colaborador foi há ' + monthsSinceLastRaise + ' mês(es) (em ' +
              lastRaise.effectiveDate + ') — abaixo do mínimo de ' + policy.minMonthsBetweenRaises +
              ' meses da Política de Remuneração.'
          );
        }
      }
    }

    return violations;
  },

  /**
   * Executa a simulação e retorna o resultado (sem persistir). `input`:
   * {type, directorateId, costCenterId, employeeId, currentSalary,
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

    var effectiveYear = this.parseIsoDateParts_(input.effectiveDate).year;
    var budgetedDirectoratePayroll = this.bucketBudgetAnnual_(input.directorateId, input.costCenterId, effectiveYear);
    var closedMonths = this.bucketClosedMonthsPayroll_(input.directorateId, input.costCenterId, effectiveYear);
    var currentDirectoratePayroll = closedMonths.yearToDatePayroll;

    // Meses entre o último fechamento e a movimentação (ex.: fechamento até
    // agosto, movimentação efetiva em novembro) não têm folha real nem
    // impacto da movimentação ainda — para não ficarem de fora da projeção
    // anual, replicam o último fechamento sem o impacto (setembro/outubro
    // no exemplo); a partir do mês da movimentação, a projeção normal
    // (último fechamento + impacto, meses restantes) assume.
    var effectiveMonth = this.parseIsoDateParts_(input.effectiveDate).month;
    var gapMonths = closedMonths.lastClosedMonth ? Math.max(0, effectiveMonth - closedMonths.lastClosedMonth - 1) : 0;
    var gapPayroll = closedMonths.lastMonthPayroll * gapMonths;

    // Projeção até dezembro: acumulado real (meses já fechados) + meses de
    // lacuna replicados sem impacto + meses que faltam no ano, projetados a
    // partir do último fechamento já com o impacto mensal total da
    // movimentação — não um simples "atual anual + impacto x meses", que
    // ignoraria o histórico real do centro de custo.
    var projectedMonthlyPayroll = closedMonths.lastMonthPayroll + totalMonthlyImpact;
    var projectedRemainingPayroll = projectedMonthlyPayroll * monthsRemaining;
    var payrollAfterApproval = closedMonths.yearToDatePayroll + gapPayroll + projectedRemainingPayroll;
    var difference = budgetedDirectoratePayroll - payrollAfterApproval;
    var percentConsumed = budgetedDirectoratePayroll > 0 ? (payrollAfterApproval / budgetedDirectoratePayroll) * 100 : 0;
    var exceedsBudget = payrollAfterApproval > budgetedDirectoratePayroll;

    var alertMessage;
    if (!input.costCenterId) {
      alertMessage = 'Não foi possível localizar o centro de resultado para comparar com o orçamento.';
    } else if (exceedsBudget) {
      var excessPercent =
        budgetedDirectoratePayroll > 0
          ? ((payrollAfterApproval - budgetedDirectoratePayroll) / budgetedDirectoratePayroll) * 100
          : 100;
      alertMessage = 'Movimentação excede o orçamento do centro de resultado em ' + excessPercent.toFixed(1) + '%.';
    } else {
      alertMessage = 'Movimentação aderente ao orçamento.';
    }

    var baseSalary = Number(input.currentSalary || 0);
    var salaryIncreasePercent = baseSalary > 0 ? (monthlySalaryImpact / baseSalary) * 100 : null;
    var policyViolations = this.checkPolicyViolations_(input, salaryIncreasePercent);

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
      policyViolations: policyViolations,
    };
  },

  /** Adapta um MovementRequest persistido (aba Movimentacoes) para SimulationInput. */
  simulationInputFromMovement_: function (movement) {
    return {
      type: movement.type,
      directorateId: movement.directorateId,
      costCenterId: movement.costCenterId,
      employeeId: movement.employeeId,
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

    var inserted = Tables.movementSimulations.insert({
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
      policyViolations: serializePolicyViolations_(result.policyViolations),
      createdAt: nowIso_(),
    });
    // A aba guarda policyViolations como texto (uma mensagem por linha); o
    // valor devolvido ao chamador (e ao cliente) é sempre o array em
    // memória, igual ao formato de simulate() e de latestSimulation().
    inserted.policyViolations = result.policyViolations;
    return inserted;
  },

  latestSimulation: function (movementId) {
    var all = Tables.movementSimulations.where(function (s) {
      return s.movementRequestId === movementId;
    });
    if (all.length === 0) return null;
    all.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    var latest = shallowCopy_(all[0]);
    latest.policyViolations = parsePolicyViolations_(all[0].policyViolations);
    return latest;
  },
};

function round3_(value) {
  return Math.round(value * 1000) / 1000;
}
