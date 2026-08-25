/**
 * Estudos salariais / benchmark de mercado — espelha
 * backend/src/modules/salary-studies.
 */

var SalaryStudiesService = {
  list: function () {
    var studies = Tables.salaryStudies.all();
    studies.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return studies;
  },

  getEntries: function (studyId) {
    var study = Tables.salaryStudies.get(studyId);
    if (!study) throw new Error('Estudo salarial não encontrado: ' + studyId);
    return Tables.salaryStudyEntries.where(function (e) {
      return e.studyId === studyId;
    });
  },

  /**
   * Importa uma pesquisa salarial. Colunas esperadas (normalizadas): cargo,
   * empresa, salario_minimo, salario_medio, salario_maximo, percentil_25,
   * percentil_50, percentil_75, percentil_90.
   */
  importFromFile: function (base64Data, mimeType, filename, meta, importedByEmail) {
    var study = Tables.salaryStudies.insert({
      name: meta.name,
      source: meta.source || '',
      referenceYear: meta.referenceYear,
      importedByEmail: importedByEmail,
      createdAt: nowIso_(),
    });

    var records = parseUploadedSpreadsheet_(base64Data, mimeType, filename);
    var errors = [];
    var successRows = 0;

    records.forEach(function (record) {
      var data = record.data;
      var positionName = String(data.cargo || '').trim();
      if (!positionName) {
        errors.push({ rowNumber: record.rowNumber, field: 'cargo', message: 'Cargo é obrigatório' });
        return;
      }
      var position = OrgService.findPositionByName(positionName);
      if (!position) {
        errors.push({ rowNumber: record.rowNumber, field: 'cargo', message: 'Cargo inexistente: ' + positionName });
        return;
      }

      Tables.salaryStudyEntries.insert({
        studyId: study.id,
        positionId: position.id,
        companyName: data.empresa ? String(data.empresa) : '',
        minSalary: toNumber_(data.salario_minimo) || '',
        avgSalary: toNumber_(data.salario_medio) || '',
        maxSalary: toNumber_(data.salario_maximo) || '',
        p25: toNumber_(data.percentil_25) || '',
        p50: toNumber_(data.percentil_50) || '',
        p75: toNumber_(data.percentil_75) || '',
        p90: toNumber_(data.percentil_90) || '',
        createdAt: nowIso_(),
      });
      successRows += 1;
    });

    logImportBatch_('ESTUDO_SALARIAL', meta.referenceYear, importedByEmail, records.length, successRows, errors);
    return { study: study, totalRows: records.length, successRows: successRows, errors: errors };
  },

  /**
   * Compara o salário atual dos colaboradores com o mercado (média das
   * entradas de estudo salarial para o mesmo cargo). Classificação por
   * faixa de percentil: abaixo do P25 = abaixo do mercado; acima do P75 =
   * acima do mercado; caso contrário, dentro do mercado.
   */
  getPositioning: function (filters, scope) {
    filters = filters || {};
    scope = scope || {};

    var employees = Tables.employees.where(function (e) {
      if (!matchesAccessScope_(e, scope)) return false;
      if (filters.positionId && e.positionId !== filters.positionId) return false;
      return true;
    });
    if (employees.length === 0) return [];

    var positions = indexById_(Tables.positions.all());
    var directorates = indexById_(Tables.directorates.all());

    var positionIds = {};
    employees.forEach(function (e) {
      positionIds[e.positionId] = true;
    });

    var entries = Tables.salaryStudyEntries.where(function (e) {
      return !!positionIds[e.positionId];
    });

    var marketByPosition = {};
    entries.forEach(function (entry) {
      var acc = marketByPosition[entry.positionId] || { p25: 0, p50: 0, p75: 0, p90: 0, count: 0 };
      acc.p25 += Number(entry.p25 || 0);
      acc.p50 += Number(entry.p50 || 0);
      acc.p75 += Number(entry.p75 || 0);
      acc.p90 += Number(entry.p90 || 0);
      acc.count += 1;
      marketByPosition[entry.positionId] = acc;
    });

    return employees.map(function (employee) {
      var market = marketByPosition[employee.positionId];
      var base = {
        employee: {
          id: employee.id,
          name: employee.name,
          registration: employee.registration,
          positionName: positions[employee.positionId] ? positions[employee.positionId].name : null,
          directorateName: directorates[employee.directorateId] ? directorates[employee.directorateId].name : null,
        },
        currentSalary: employee.currentSalary,
      };

      if (!market || market.count === 0) {
        return Object.assign(base, { marketP25: null, marketP50: null, marketP75: null, marketP90: null, classification: null });
      }

      var p25 = market.p25 / market.count;
      var p50 = market.p50 / market.count;
      var p75 = market.p75 / market.count;
      var p90 = market.p90 / market.count;

      var classification;
      if (Number(employee.currentSalary) < p25) classification = MarketPosition.ABAIXO_DO_MERCADO;
      else if (Number(employee.currentSalary) > p75) classification = MarketPosition.ACIMA_DO_MERCADO;
      else classification = MarketPosition.DENTRO_DO_MERCADO;

      return Object.assign(base, {
        marketP25: round2_(p25),
        marketP50: round2_(p50),
        marketP75: round2_(p75),
        marketP90: round2_(p90),
        classification: classification,
      });
    });
  },
};
