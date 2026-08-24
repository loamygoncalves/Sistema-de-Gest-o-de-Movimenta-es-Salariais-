/**
 * Histórico de movimentações aprovadas — espelha
 * backend/src/modules/history. A exportação Excel/PDF do backend original
 * (gerada com exceljs/pdfkit) é substituída por uma abordagem nativa do
 * Apps Script: os registros filtrados são escritos em uma planilha Google
 * temporária, que pode ser aberta diretamente ou baixada via o endpoint de
 * exportação padrão do Google Sheets (?format=xlsx|pdf).
 */

var HistoryService = {
  _filtered: function (filters, scopedDirectorateId) {
    filters = filters || {};
    var directorateId = scopedDirectorateId || filters.directorateId;

    var records = Tables.movementHistory.where(function (h) {
      if (directorateId && h.directorateId !== directorateId) return false;
      if (filters.positionId && h.positionId !== filters.positionId) return false;
      if (filters.type && h.type !== filters.type) return false;
      if (filters.costCenterId && h.costCenterId !== filters.costCenterId) return false;
      if (filters.startDate && h.effectiveDate < filters.startDate) return false;
      if (filters.endDate && h.effectiveDate > filters.endDate) return false;
      return true;
    });

    records.sort(function (a, b) {
      return new Date(b.effectiveDate) - new Date(a.effectiveDate);
    });
    return records;
  },

  list: function (filters, scopedDirectorateId) {
    var employees = indexById_(Tables.employees.all());
    var directorates = indexById_(Tables.directorates.all());
    var positions = indexById_(Tables.positions.all());

    return this._filtered(filters, scopedDirectorateId).map(function (h) {
      var copy = shallowCopy_(h);
      copy.employeeName = h.employeeId && employees[h.employeeId] ? employees[h.employeeId].name : null;
      copy.directorateName = directorates[h.directorateId] ? directorates[h.directorateId].name : null;
      copy.positionName = h.positionId && positions[h.positionId] ? positions[h.positionId].name : null;
      return copy;
    });
  },

  getIndicators: function (filters, scopedDirectorateId) {
    var records = this._filtered(filters, scopedDirectorateId);

    var promotionsCount = records.filter(function (r) {
      return r.type === MovementType.PROMOCAO;
    }).length;
    var meritsCount = records.filter(function (r) {
      return r.type === MovementType.MERITO;
    }).length;
    var accumulatedImpact = sumBy_(records, 'annualImpact');

    var growthRecords = records.filter(function (r) {
      return Number(r.previousSalary) > 0;
    });
    var salaryGrowthPercent =
      growthRecords.length > 0
        ? growthRecords.reduce(function (sum, r) {
            return sum + ((Number(r.newSalary) - Number(r.previousSalary)) / Number(r.previousSalary)) * 100;
          }, 0) / growthRecords.length
        : 0;

    var headcountByMonth = {};
    records.forEach(function (r) {
      var month = String(r.effectiveDate).slice(0, 7);
      var delta = r.type === MovementType.AUMENTO_QUADRO ? 1 : 0;
      headcountByMonth[month] = (headcountByMonth[month] || 0) + delta;
    });
    var headcountEvolution = Object.keys(headcountByMonth)
      .sort()
      .map(function (month) {
        return { month: month, hc: headcountByMonth[month] };
      });

    return {
      promotionsCount: promotionsCount,
      meritsCount: meritsCount,
      transfersCount: records.filter(function (r) {
        return r.type === MovementType.TRANSFERENCIA;
      }).length,
      headcountIncreaseCount: records.filter(function (r) {
        return r.type === MovementType.AUMENTO_QUADRO;
      }).length,
      salaryGrowthPercent: round2_(salaryGrowthPercent),
      accumulatedImpact: accumulatedImpact,
      headcountEvolution: headcountEvolution,
    };
  },

  /** Cria uma planilha Google com os registros filtrados e devolve os links de acesso/exportação. */
  exportToSheet: function (filters, scopedDirectorateId) {
    var records = this.list(filters, scopedDirectorateId);
    var ss = SpreadsheetApp.create('SGMS - Histórico de Movimentações - ' + Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM-dd HHmm'));
    var sheet = ss.getSheets()[0];
    var headers = [
      'Data Efetiva', 'Tipo', 'Colaborador', 'Diretoria', 'Cargo',
      'Salário Anterior', 'Novo Salário', 'Impacto Mensal', 'Impacto Anual', 'Aprovado em',
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    if (records.length > 0) {
      var rows = records.map(function (r) {
        return [
          r.effectiveDate, r.type, r.employeeName || '-', r.directorateName || '-', r.positionName || '-',
          r.previousSalary, r.newSalary, r.monthlyImpact, r.annualImpact, r.approvedAt,
        ];
      });
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    sheet.autoResizeColumns(1, headers.length);

    var id = ss.getId();
    return {
      spreadsheetUrl: ss.getUrl(),
      xlsxExportUrl: 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx',
      pdfExportUrl: 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=pdf',
    };
  },
};
