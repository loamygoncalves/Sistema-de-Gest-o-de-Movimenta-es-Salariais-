/**
 * Dashboards executivos — espelha backend/src/modules/dashboard.
 */

var DashboardService = {
  getHeadcount: function (year, directorateId) {
    var budgetEntries = BudgetService.listEntries(year, directorateId);
    var hcCurrent = Tables.employees.where(function (e) {
      return !directorateId || e.directorateId === directorateId;
    }).length;

    var approvedIncreases = Tables.movementRequests.where(function (m) {
      if (m.type !== MovementType.AUMENTO_QUADRO) return false;
      if (m.status !== MovementStatus.APROVADO) return false;
      if (String(m.effectiveDate).slice(0, 4) !== String(year)) return false;
      if (directorateId && m.directorateId !== directorateId) return false;
      return true;
    });
    var hcApproved = approvedIncreases.reduce(function (sum, m) {
      return sum + Number(m.quantity || 0);
    }, 0);

    var openPositions = budgetEntries.filter(function (b) {
      return b.plannedSituation === PlannedSituation.NOVA_VAGA;
    }).length;
    var hcOpen = Math.max(0, openPositions - hcApproved);

    return { hcBudgeted: budgetEntries.length, hcCurrent: hcCurrent, hcApproved: hcApproved, hcOpen: hcOpen };
  },

  getPayroll: function (year, directorateId) {
    return BudgetService.getDashboard(year, directorateId);
  },

  getMovements: function (year, directorateId) {
    var movements = Tables.movementRequests.where(function (m) {
      if (String(m.effectiveDate).slice(0, 4) !== String(year)) return false;
      if (directorateId && m.directorateId !== directorateId) return false;
      return true;
    });
    return {
      promotions: movements.filter(function (m) { return m.type === MovementType.PROMOCAO; }).length,
      merits: movements.filter(function (m) { return m.type === MovementType.MERITO; }).length,
      headcountIncrease: movements.filter(function (m) { return m.type === MovementType.AUMENTO_QUADRO; }).length,
      transfers: movements.filter(function (m) { return m.type === MovementType.TRANSFERENCIA; }).length,
    };
  },

  getFinancial: function (year, directorateId) {
    var historyRecords = Tables.movementHistory.where(function (h) {
      if (String(h.effectiveDate).slice(0, 4) !== String(year)) return false;
      if (directorateId && h.directorateId !== directorateId) return false;
      return true;
    });

    var monthlyImpact = sumBy_(historyRecords, 'monthlyImpact');
    var annualImpact = sumBy_(historyRecords, 'annualImpact');

    var payroll = BudgetService.getDashboard(year, directorateId);
    var budgetConsumedPercent = payroll.payrollBudgeted > 0 ? (payroll.payrollCurrent / payroll.payrollBudgeted) * 100 : 0;

    return {
      monthlyImpact: monthlyImpact,
      annualImpact: annualImpact,
      budgetConsumedPercent: round2_(budgetConsumedPercent),
      projection12Months: this._projection12Months(directorateId),
      directorateRanking: this._directorateRanking(),
    };
  },

  _projection12Months: function (directorateId) {
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
      if (directorateId && m.directorateId !== directorateId) return false;
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
