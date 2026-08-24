/**
 * Orçamento anual de pessoal — espelha backend/src/modules/budget.
 */

var SITUATION_ALIASES_ = {
  SEM_MOVIMENTACAO: PlannedSituation.SEM_MOVIMENTACAO,
  'SEM MOVIMENTACAO': PlannedSituation.SEM_MOVIMENTACAO,
  PROMOCAO: PlannedSituation.PROMOCAO,
  MERITO: PlannedSituation.MERITO,
  TRANSFERENCIA: PlannedSituation.TRANSFERENCIA,
  NOVA_VAGA: PlannedSituation.NOVA_VAGA,
  'NOVA VAGA': PlannedSituation.NOVA_VAGA,
};

var BudgetService = {
  listEntries: function (year, scopedDirectorateId) {
    return Tables.budgetEntries.where(function (b) {
      return Number(b.year) === Number(year) && (!scopedDirectorateId || b.directorateId === scopedDirectorateId);
    });
  },

  getDashboard: function (year, scopedDirectorateId) {
    var budgetEntries = this.listEntries(year, scopedDirectorateId);
    var employees = Tables.employees.where(function (e) {
      return !scopedDirectorateId || e.directorateId === scopedDirectorateId;
    });

    var hcBudgeted = budgetEntries.length;
    var hcCurrent = employees.length;
    var payrollBudgeted = sumBy_(budgetEntries, 'currentSalary');
    var payrollCurrent = sumBy_(employees, 'currentSalary');
    var financialDeviation = payrollCurrent - payrollBudgeted;
    var budgetConsumedPercent = payrollBudgeted > 0 ? (payrollCurrent / payrollBudgeted) * 100 : 0;

    return {
      hcBudgeted: hcBudgeted,
      hcCurrent: hcCurrent,
      hcDifference: hcCurrent - hcBudgeted,
      payrollBudgeted: payrollBudgeted,
      payrollCurrent: payrollCurrent,
      financialDeviation: financialDeviation,
      budgetConsumedPercent: round2_(budgetConsumedPercent),
    };
  },

  /**
   * Importa o orçamento anual. Colunas esperadas (normalizadas): matricula,
   * nome, cargo, diretoria, cidade, estado, tipo_contrato, data_admissao,
   * salario_atual, situacao_planejada, salario_orcado, mes_previsto,
   * custo_mensal_orcado, custo_anual_orcado.
   */
  importFromFile: function (base64Data, mimeType, filename, year, importedByEmail) {
    var records = parseUploadedSpreadsheet_(base64Data, mimeType, filename);
    var errors = [];
    var successRows = 0;
    var seen = {};

    records.forEach(function (record) {
      var data = record.data;
      var registration = data.matricula ? String(data.matricula).trim() : '';
      var name = String(data.nome || '').trim();
      var positionName = String(data.cargo || '').trim();
      var directorateName = String(data.diretoria || '').trim();
      var currentSalary = toNumber_(data.salario_atual) || 0;
      var plannedSalary = toNumber_(data.salario_orcado) || 0;
      var situationRaw = String(data.situacao_planejada || 'SEM_MOVIMENTACAO').trim().toUpperCase();
      var plannedMonth = toNumber_(data.mes_previsto);
      var monthlyBudgetedCost = toNumber_(data.custo_mensal_orcado) || 0;
      var annualBudgetedCost = toNumber_(data.custo_anual_orcado) || 0;
      var plannedSituation = SITUATION_ALIASES_[situationRaw];

      function fail(field, message) {
        errors.push({ rowNumber: record.rowNumber, field: field, message: message });
      }

      if (!positionName) return fail('cargo', 'Cargo é obrigatório');
      if (!directorateName) return fail('diretoria', 'Diretoria é obrigatória');
      if (!plannedSituation) return fail('situacao_planejada', 'Situação planejada inválida: ' + situationRaw);
      if (plannedSituation !== PlannedSituation.NOVA_VAGA && !registration) {
        return fail('matricula', 'Matrícula é obrigatória');
      }
      if (registration) {
        if (seen[registration]) return fail('matricula', 'Matrícula duplicada na planilha: ' + registration);
        seen[registration] = true;
      }
      if (currentSalary < 0 || plannedSalary < 0) return fail('salario', 'Salário inválido');

      var position = OrgService.findPositionByName(positionName);
      if (!position) return fail('cargo', 'Cargo inexistente: ' + positionName);
      var directorate = OrgService.findDirectorateByName(directorateName);
      if (!directorate) return fail('diretoria', 'Diretoria inexistente: ' + directorateName);

      var employee = registration
        ? Tables.employees.findOne(function (r) {
            return r.registration === registration;
          })
        : null;

      var existing = registration
        ? Tables.budgetEntries.findOne(function (r) {
            return Number(r.year) === Number(year) && r.registration === registration;
          })
        : null;

      var payload = {
        year: year,
        registration: registration,
        employeeId: employee ? employee.id : '',
        name: name || (employee ? employee.name : ''),
        positionId: position.id,
        directorateId: directorate.id,
        city: data.cidade ? String(data.cidade) : '',
        state: data.estado ? String(data.estado).toUpperCase().slice(0, 2) : '',
        contractType: employee ? employee.contractType : ContractType.CLT,
        admissionDate: toDateIso_(data.data_admissao) || '',
        currentSalary: currentSalary,
        plannedSituation: plannedSituation,
        plannedSalary: plannedSalary,
        plannedMonth: plannedMonth || '',
        monthlyBudgetedCost: monthlyBudgetedCost,
        annualBudgetedCost: annualBudgetedCost,
      };

      if (existing) {
        Tables.budgetEntries.update(existing.id, payload);
      } else {
        payload.createdAt = nowIso_();
        Tables.budgetEntries.insert(payload);
      }
      successRows += 1;
    });

    var batch = logImportBatch_('ORCAMENTO', year, importedByEmail, records.length, successRows, errors);
    return { batch: batch, totalRows: records.length, successRows: successRows, errors: errors };
  },
};

function sumBy_(records, field) {
  return records.reduce(function (sum, r) {
    return sum + Number(r[field] || 0);
  }, 0);
}

function round2_(value) {
  return Math.round(value * 100) / 100;
}
