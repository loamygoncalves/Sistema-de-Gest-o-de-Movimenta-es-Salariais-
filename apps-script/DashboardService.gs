/**
 * Dashboards executivos — espelha backend/src/modules/dashboard. `scope` já
 * chega mesclado com os filtros explícitos da UI (ver
 * Auth.gs#mergeAccessScope_, chamado em Api.gs).
 */

/** Meses efetivos para um filtro opcional: os informados, ou só o mês corrente. */
function resolveDashboardMonths_(months) {
  if (months && months.length > 0) return months;
  return [new Date().getMonth() + 1];
}

function average_(values) {
  if (values.length === 0) return 0;
  var sum = values.reduce(function (a, b) { return a + b; }, 0);
  return Math.round(sum / values.length);
}

var DashboardService = {
  /**
   * `months` é uma lista (1 ou mais meses, 1-12). HC é a MÉDIA entre os
   * meses selecionados (headcount não é aditivo); folha é a SOMA (ver
   * getPayroll). Isso é o que dá ao Dashboard Executivo a visão "acumulado
   * do ano"/"vários meses selecionados" pedida pelo usuário, em vez de só
   * um mês por vez.
   */
  getHeadcount: function (year, months, scope) {
    scope = scope || {};
    var referenceMonths = resolveDashboardMonths_(months);
    var allBudgetEntries = BudgetService.listEntries(year, scope);
    var salariesByMonth = resolveMonthlySalaryRowsForMonths_(year, referenceMonths, scope);

    var approvedIncreases = Tables.movementRequests.where(function (m) {
      if (m.type !== MovementType.AUMENTO_QUADRO) return false;
      if (m.status !== MovementStatus.APROVADO) return false;
      if (String(m.effectiveDate).slice(0, 4) !== String(year)) return false;
      if (!matchesAccessScope_(m, scope)) return false;
      return true;
    });
    var hcApproved = approvedIncreases.reduce(function (sum, m) {
      return sum + Number(m.quantity || 0);
    }, 0);

    var byMonth = referenceMonths.map(function (month) {
      var budgetEntries = allBudgetEntries.filter(function (entry) {
        return monthValue_(entry, month) !== null;
      });
      var openPositions = budgetEntries.filter(function (b) {
        return b.movementType === PlannedSituation.AUMENTO_DE_QUADRO;
      }).length;
      var monthly = salariesByMonth[month];
      return {
        month: month,
        hcBudgeted: budgetEntries.length,
        hcCurrent: monthly.rows.length,
        hcOpen: Math.max(0, openPositions - hcApproved),
        monthClosed: monthly.monthClosed,
      };
    });

    var openMonths = byMonth.filter(function (m) { return !m.monthClosed; }).map(function (m) { return m.month; });

    return {
      year: year,
      months: referenceMonths,
      hcBudgeted: average_(byMonth.map(function (m) { return m.hcBudgeted; })),
      hcCurrent: average_(byMonth.map(function (m) { return m.hcCurrent; })),
      hcApproved: hcApproved,
      hcOpen: average_(byMonth.map(function (m) { return m.hcOpen; })),
      monthClosed: openMonths.length === 0,
      openMonths: openMonths,
      byMonth: byMonth,
    };
  },

  getPayroll: function (year, months, scope) {
    scope = scope || {};
    var referenceMonths = resolveDashboardMonths_(months);
    var allBudgetEntries = BudgetService.listEntries(year, scope);
    var salariesByMonth = resolveMonthlySalaryRowsForMonths_(year, referenceMonths, scope);

    var byMonth = referenceMonths.map(function (month) {
      var budgeted = allBudgetEntries.reduce(function (sum, b) {
        return sum + Number(monthValue_(b, month) || 0);
      }, 0);
      var monthly = salariesByMonth[month];
      var current = monthly.rows.reduce(function (sum, row) { return sum + row.salary; }, 0);
      return { month: month, payrollBudgeted: budgeted, payrollCurrent: current, monthClosed: monthly.monthClosed };
    });

    var openMonths = byMonth.filter(function (m) { return !m.monthClosed; }).map(function (m) { return m.month; });
    var payrollBudgeted = byMonth.reduce(function (sum, m) { return sum + m.payrollBudgeted; }, 0);
    var payrollCurrent = byMonth.reduce(function (sum, m) { return sum + m.payrollCurrent; }, 0);

    return {
      year: year,
      months: referenceMonths,
      payrollCurrent: payrollCurrent,
      payrollBudgeted: payrollBudgeted,
      difference: payrollCurrent - payrollBudgeted,
      monthClosed: openMonths.length === 0,
      openMonths: openMonths,
      byMonth: byMonth,
    };
  },

  /**
   * Orçado x Atual por centro de custo, somando/mediando os meses do
   * filtro — dá a uma diretoria a visão de quais dos seus centros de custo
   * estão dentro ou fora do orçamento no período escolhido. Custo é somado
   * entre os meses (gasto acumulado); headcount é a média.
   */
  getCostCenterBreakdown: function (year, months, scope) {
    scope = scope || {};
    var referenceMonths = resolveDashboardMonths_(months);
    var allBudgetEntries = BudgetService.listEntries(year, scope);
    var salariesByMonth = resolveMonthlySalaryRowsForMonths_(year, referenceMonths, scope);
    var directorateNames = indexById_(Tables.directorates.all());
    var costCenterNames = indexById_(Tables.costCenters.all());

    var buckets = {};
    function bucketKey(directorateId, costCenterId) {
      return directorateId + '|' + costCenterId;
    }
    function getBucket(directorateId, costCenterId, directorateName, costCenterName) {
      var key = bucketKey(directorateId, costCenterId);
      if (!buckets[key]) {
        buckets[key] = {
          directorateId: directorateId,
          directorateName: directorateName,
          costCenterId: costCenterId,
          costCenterName: costCenterName,
          budgetedCost: 0,
          currentCost: 0,
          budgetedCountByMonth: {},
          currentCountByMonth: {},
        };
      }
      return buckets[key];
    }

    referenceMonths.forEach(function (month) {
      allBudgetEntries.forEach(function (entry) {
        var value = monthValue_(entry, month);
        if (value === null) return;
        var directorateName = directorateNames[entry.directorateId] ? directorateNames[entry.directorateId].name : null;
        var costCenterName = costCenterNames[entry.costCenterId] ? costCenterNames[entry.costCenterId].name : null;
        var bucket = getBucket(entry.directorateId, entry.costCenterId, directorateName, costCenterName);
        bucket.budgetedCost += Number(value);
        bucket.budgetedCountByMonth[month] = (bucket.budgetedCountByMonth[month] || 0) + 1;
      });
      salariesByMonth[month].rows.forEach(function (row) {
        if (!row.costCenterId) return;
        var bucket = getBucket(row.directorateId, row.costCenterId, row.directorateName, row.costCenterName);
        bucket.currentCost += row.salary;
        bucket.currentCountByMonth[month] = (bucket.currentCountByMonth[month] || 0) + 1;
      });
    });

    var monthCount = referenceMonths.length;
    function avgFromMonthMap(map) {
      var sum = referenceMonths.reduce(function (s, m) { return s + (map[m] || 0); }, 0);
      return Math.round(sum / monthCount);
    }

    var items = Object.keys(buckets)
      .map(function (key) {
        var bucket = buckets[key];
        return {
          directorateId: bucket.directorateId,
          directorateName: bucket.directorateName,
          costCenterId: bucket.costCenterId,
          costCenterName: bucket.costCenterName,
          budgetedCost: bucket.budgetedCost,
          currentCost: bucket.currentCost,
          difference: bucket.currentCost - bucket.budgetedCost,
          budgetedCount: avgFromMonthMap(bucket.budgetedCountByMonth),
          currentCount: avgFromMonthMap(bucket.currentCountByMonth),
          status: bucket.currentCost > bucket.budgetedCost ? 'ACIMA' : 'DENTRO',
        };
      })
      .sort(function (a, b) { return b.difference - a.difference; });

    return {
      year: year,
      months: referenceMonths,
      items: items,
    };
  },

  getMovements: function (year, scope) {
    scope = scope || {};
    var movements = Tables.movementRequests.where(function (m) {
      if (String(m.effectiveDate).slice(0, 4) !== String(year)) return false;
      if (!matchesAccessScope_(m, scope)) return false;
      return true;
    });
    return {
      promotions: movements.filter(function (m) { return m.type === MovementType.PROMOCAO; }).length,
      merits: movements.filter(function (m) { return m.type === MovementType.MERITO; }).length,
      headcountIncrease: movements.filter(function (m) { return m.type === MovementType.AUMENTO_QUADRO; }).length,
    };
  },

  getFinancial: function (year, months, scope) {
    scope = scope || {};
    var historyRecords = Tables.movementHistory.where(function (h) {
      if (String(h.effectiveDate).slice(0, 4) !== String(year)) return false;
      if (!matchesAccessScope_(h, scope)) return false;
      return true;
    });

    var monthlyImpact = sumBy_(historyRecords, 'monthlyImpact');
    var annualImpact = sumBy_(historyRecords, 'annualImpact');

    var payroll = this.getPayroll(year, months, scope);
    var budgetConsumedPercent = payroll.payrollBudgeted > 0 ? (payroll.payrollCurrent / payroll.payrollBudgeted) * 100 : 0;

    // Ranking de Diretorias compara todas as diretorias entre si — GESTOR
    // (identificado por ter costCenterIds no escopo) não deve ter acesso a
    // esse comparativo cross-empresa, só à própria área.
    var directorateRanking = scope.costCenterIds ? [] : this._directorateRanking(year, payroll.months);

    return {
      months: payroll.months,
      monthlyImpact: monthlyImpact,
      annualImpact: annualImpact,
      budgetConsumedPercent: round2_(budgetConsumedPercent),
      projection12Months: this._projection12Months(scope),
      directorateRanking: directorateRanking,
      monthClosed: payroll.monthClosed,
      openMonths: payroll.openMonths,
    };
  },

  _projection12Months: function (scope) {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), 1);
    var end = new Date(now.getFullYear(), now.getMonth() + 12, 0);
    var startIso = Utilities.formatDate(start, 'GMT', 'yyyy-MM-dd');
    var endIso = Utilities.formatDate(end, 'GMT', 'yyyy-MM-dd');

    var eligibleStatuses = [MovementStatus.APROVADO, MovementStatus.PENDENTE_APROVACAO];

    var movements = Tables.movementRequests.where(function (m) {
      if (eligibleStatuses.indexOf(m.status) === -1) return false;
      if (m.effectiveDate < startIso || m.effectiveDate > endIso) return false;
      if (!matchesAccessScope_(m, scope)) return false;
      return true;
    });

    var byMonth = {};
    for (var i = 0; i < 12; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      byMonth[Utilities.formatDate(d, 'GMT', 'yyyy-MM')] = 0;
    }

    movements.forEach(function (m) {
      var simulation = SimulatorService.latestSimulation(m.id);
      if (!simulation) return;
      var month = String(m.effectiveDate).slice(0, 7);
      if (byMonth.hasOwnProperty(month)) {
        byMonth[month] += Number(simulation.totalMonthlyImpact || 0);
      }
    });

    return Object.keys(byMonth)
      .sort()
      .map(function (month) {
        return { month: month, impact: byMonth[month] };
      });
  },

  /**
   * Folha atual por diretoria usa exclusivamente o fechamento da folha
   * (aba FechamentoFolha) dos meses selecionados — nunca employees.
   * currentSalary ao vivo, pelo mesmo motivo do resto do dashboard: o
   * cadastro reflete o salário mais recente de cada colaborador, não o da
   * folha fechada de um mês específico. Soma os meses selecionados, igual
   * à Folha Atual da seção de Folha de Pagamento — não é mais anualizado
   * (× 12).
   */
  _directorateRanking: function (year, months) {
    var directorates = Tables.directorates.all();
    var snapshots = Tables.payrollSnapshots.where(function (s) {
      return Number(s.year) === Number(year) && months.indexOf(Number(s.month)) !== -1;
    });

    var payrollByDirectorate = {};
    snapshots.forEach(function (s) {
      payrollByDirectorate[s.directorateId] = (payrollByDirectorate[s.directorateId] || 0) + Number(s.salary || 0);
    });

    return directorates
      .map(function (d) {
        var currentPayroll = payrollByDirectorate[d.id] || 0;
        var consumedPercent = Number(d.annualBudget) > 0 ? (currentPayroll / Number(d.annualBudget)) * 100 : 0;
        return {
          directorate: d.name,
          currentPayroll: currentPayroll,
          annualBudget: Number(d.annualBudget),
          consumedPercent: round2_(consumedPercent),
        };
      })
      .sort(function (a, b) {
        return b.consumedPercent - a.consumedPercent;
      });
  },
};
