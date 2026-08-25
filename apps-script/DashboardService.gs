/**
 * Dashboards executivos — espelha backend/src/modules/dashboard. `scope` já
 * chega mesclado com os filtros explícitos da UI (ver
 * Auth.gs#mergeAccessScope_, chamado em Api.gs).
 */

var DashboardService = {
  getHeadcount: function (year, month, scope) {
    scope = scope || {};
    var referenceMonth = month || new Date().getMonth() + 1;
    var allBudgetEntries = BudgetService.listEntries(year, scope);
    var budgetEntries = allBudgetEntries.filter(function (entry) {
      return monthValue_(entry, referenceMonth) !== null;
    });

    var hcCurrent = Tables.employees.where(function (e) {
      return matchesAccessScope_(e, scope);
    }).length;

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

    var openPositions = budgetEntries.filter(function (b) {
      return b.movementType === PlannedSituation.AUMENTO_DE_QUADRO;
    }).length;
    var hcOpen = Math.max(0, openPositions - hcApproved);

    return {
      year: year,
      month: referenceMonth,
      hcBudgeted: budgetEntries.length,
      hcCurrent: hcCurrent,
      hcApproved: hcApproved,
      hcOpen: hcOpen,
    };
  },

  getPayroll: function (year, month, scope) {
    scope = scope || {};
    var referenceMonth = month || new Date().getMonth() + 1;
    var allBudgetEntries = BudgetService.listEntries(year, scope);
    var budgetEntries = allBudgetEntries.filter(function (entry) {
      return monthValue_(entry, referenceMonth) !== null;
    });

    var employees = Tables.employees.where(function (e) {
      return matchesAccessScope_(e, scope);
    });

    var payrollBudgeted = budgetEntries.reduce(function (sum, b) {
      return sum + Number(monthValue_(b, referenceMonth) || 0);
    }, 0);
    var payrollCurrent = sumBy_(employees, 'currentSalary');

    return {
      year: year,
      month: referenceMonth,
      payrollCurrent: payrollCurrent,
      payrollBudgeted: payrollBudgeted,
      difference: payrollCurrent - payrollBudgeted,
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

  getFinancial: function (year, month, scope) {
    scope = scope || {};
    var historyRecords = Tables.movementHistory.where(function (h) {
      if (String(h.effectiveDate).slice(0, 4) !== String(year)) return false;
      if (!matchesAccessScope_(h, scope)) return false;
      return true;
    });

    var monthlyImpact = sumBy_(historyRecords, 'monthlyImpact');
    var annualImpact = sumBy_(historyRecords, 'annualImpact');

    var payroll = this.getPayroll(year, month, scope);
    var budgetConsumedPercent = payroll.payrollBudgeted > 0 ? (payroll.payrollCurrent / payroll.payrollBudgeted) * 100 : 0;

    return {
      monthlyImpact: monthlyImpact,
      annualImpact: annualImpact,
      budgetConsumedPercent: round2_(budgetConsumedPercent),
      projection12Months: this._projection12Months(scope),
      directorateRanking: this._directorateRanking(),
    };
  },

  _projection12Months: function (scope) {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), 1);
    var end = new Date(now.getFullYear(), now.getMonth() + 12, 0);
    var startIso = Utilities.formatDate(start, 'GMT', 'yyyy-MM-dd');
    var endIso = Utilities.formatDate(end, 'GMT', 'yyyy-MM-dd');

    var eligibleStatuses = [
      MovementStatus.APROVADO,
      MovementStatus.PENDENTE_DIRETOR,
      MovementStatus.PENDENTE_RH,
      MovementStatus.PENDENTE_FINANCEIRO,
    ];

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

  _directorateRanking: function () {
    var directorates = Tables.directorates.all();
    var employees = Tables.employees.all();

    var payrollByDirectorate = {};
    employees.forEach(function (e) {
      payrollByDirectorate[e.directorateId] = (payrollByDirectorate[e.directorateId] || 0) + Number(e.currentSalary || 0) * 12;
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
