/**
 * Base atual de colaboradores — espelha backend/src/modules/employees.
 */

/**
 * Folha "daquele mês": usa exclusivamente os salários congelados na aba
 * FechamentoFolha para year+month (dentro do escopo) — nunca o salário atual
 * ao vivo. Sem fechamento para esse mês, devolve {rows: [], monthClosed:
 * false} — mostrar o salário atual (que reflete o ÚLTIMO mês fechado, não
 * necessariamente o mês pedido) faria um mês sem fechamento "herdar" os
 * números de outro mês, como se as folhas tivessem sido somadas/duplicadas
 * entre meses. Devolve {rows: [{directorateId, directorateName,
 * costCenterId, salary}], monthClosed}.
 */
function resolveMonthlySalaryRows_(year, month, scope, filterActiveOnly) {
  var byMonth = resolveMonthlySalaryRowsForMonths_(year, [month], scope);
  return byMonth[month];
}

/**
 * Igual a resolveMonthlySalaryRows_, mas para vários meses de uma vez (uma
 * única varredura da aba FechamentoFolha) — usado pelo Dashboard Executivo
 * para permitir selecionar vários meses e ver o acumulado/média do período
 * (ver DashboardService.gs#getHeadcount/getPayroll/getCostCenterBreakdown).
 * Devolve um objeto { [month]: { rows, monthClosed } }.
 */
function resolveMonthlySalaryRowsForMonths_(year, months, scope) {
  scope = scope || {};
  var directorateNames = indexById_(Tables.directorates.all());
  var costCenterNames = indexById_(Tables.costCenters.all());

  var snapshots = Tables.payrollSnapshots.where(function (s) {
    if (Number(s.year) !== Number(year) || months.indexOf(Number(s.month)) === -1) return false;
    if (!matchesAccessScope_(s, scope)) return false;
    return true;
  });

  var byMonth = {};
  months.forEach(function (month) {
    var monthSnapshots = snapshots.filter(function (s) {
      return Number(s.month) === Number(month);
    });
    byMonth[month] = {
      rows: monthSnapshots.map(function (s) {
        return {
          directorateId: s.directorateId,
          directorateName: directorateNames[s.directorateId] ? directorateNames[s.directorateId].name : null,
          costCenterId: s.costCenterId || '',
          costCenterName: costCenterNames[s.costCenterId] ? costCenterNames[s.costCenterId].name : null,
          salary: Number(s.salary || 0),
        };
      }),
      monthClosed: monthSnapshots.length > 0,
    };
  });
  return byMonth;
}

/**
 * O (year, month) mais recente que já tem fechamento salvo, e o conjunto de
 * colaboradores presentes nele — calculado ANTES de uma nova importação
 * processar suas linhas, para servir de "baseline" de quem estava na folha
 * do último fechamento (ver deactivateMissingEmployees_). null se ainda não
 * houve nenhum fechamento.
 */
function latestPayrollSnapshotMonth_() {
  var snapshots = Tables.payrollSnapshots.all();
  if (snapshots.length === 0) return null;

  var year = null;
  var month = null;
  var keyNum = -1;
  snapshots.forEach(function (s) {
    var thisKeyNum = Number(s.year) * 12 + Number(s.month);
    if (thisKeyNum > keyNum) {
      keyNum = thisKeyNum;
      year = Number(s.year);
      month = Number(s.month);
    }
  });

  var employeeIds = {};
  snapshots.forEach(function (s) {
    if (Number(s.year) === year && Number(s.month) === month) {
      employeeIds[s.employeeId] = true;
    }
  });
  return { year: year, month: month, keyNum: keyNum, employeeIds: employeeIds };
}

/**
 * Inativa automaticamente quem estava ATIVO e tinha snapshot no último
 * fechamento anterior, mas não aparece no fechamento novo — sinal de que
 * saiu da empresa entre um mês e outro (ver EmployeesService#importFromFile).
 * Só é chamada quando a importação está avançando o fechamento mais recente
 * (nunca ao reimportar/corrigir um mês antigo), para não mexer no status de
 * quem já foi substituído por um fechamento posterior mais recente.
 */
function deactivateMissingEmployees_(previousLatest, currentEmployeeIds) {
  if (!previousLatest) return [];
  var deactivated = [];
  Object.keys(previousLatest.employeeIds).forEach(function (employeeId) {
    if (currentEmployeeIds[employeeId]) return;
    var employee = Tables.employees.get(employeeId);
    if (!employee || employee.status !== EmployeeStatus.ATIVO) return;
    Tables.employees.update(employeeId, { status: EmployeeStatus.INATIVO, updatedAt: nowIso_() });
    deactivated.push({ id: employeeId, registration: employee.registration, name: employee.name });
  });
  return deactivated;
}

var EmployeesService = {
  list: function (filters, scope, maskSalaryForManager) {
    filters = filters || {};
    scope = scope || {};
    var search = filters.search ? String(filters.search).toLowerCase() : null;

    var items = Tables.employees.where(function (e) {
      if (!matchesAccessScope_(e, scope)) return false;
      if (filters.positionId && e.positionId !== filters.positionId) return false;
      if (filters.status && e.status !== filters.status) return false;
      if (search) {
        var haystack = (e.name + ' ' + e.registration).toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }
      return true;
    });

    items.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    return this._withRelations(items, maskSalaryForManager);
  },

  get: function (id, maskSalaryForManager) {
    var e = Tables.employees.get(id);
    if (!e) throw new Error('Colaborador não encontrado: ' + id);
    return this._withRelations([e], maskSalaryForManager)[0];
  },

  /**
   * `maskSalaryForManager` oculta (null, nunca o valor real) o salário dos
   * colaboradores cujo cargo está marcado `hideSalaryFromManager` (ex.:
   * Gerente/Diretor) — só quando true (Api.gs só passa isso para GESTOR;
   * chamadores internos nunca passam, então nunca mascaram por padrão).
   */
  _withRelations: function (employees, maskSalaryForManager) {
    var positions = indexById_(Tables.positions.all());
    var directorates = indexById_(Tables.directorates.all());
    return employees.map(function (e) {
      var copy = shallowCopy_(e);
      var position = positions[e.positionId];
      copy.positionName = position ? position.name : null;
      copy.directorateName = directorates[e.directorateId] ? directorates[e.directorateId].name : null;
      if (maskSalaryForManager && position && position.hideSalaryFromManager) {
        copy.currentSalary = null;
      }
      return copy;
    });
  },

  create: function (input) {
    var existing = Tables.employees.findOne(function (r) {
      return String(r.registration).trim() === String(input.registration).trim();
    });
    if (existing) throw new Error('Já existe um colaborador com esta matrícula: ' + input.registration);

    return Tables.employees.insert({
      registration: input.registration,
      name: input.name,
      positionId: input.positionId,
      directorateId: input.directorateId,
      managementId: input.managementId || '',
      coordinationId: input.coordinationId || '',
      costCenterId: input.costCenterId || '',
      city: input.city || '',
      state: input.state || '',
      contractType: input.contractType || ContractType.CLT,
      admissionDate: input.admissionDate,
      currentSalary: Number(input.currentSalary),
      status: input.status || EmployeeStatus.ATIVO,
      createdAt: nowIso_(),
      updatedAt: nowIso_(),
    });
  },

  update: function (id, input) {
    input.updatedAt = nowIso_();
    return Tables.employees.update(id, input);
  },

  deactivate: function (id) {
    return Tables.employees.update(id, { status: EmployeeStatus.INATIVO, updatedAt: nowIso_() });
  },

  /**
   * Importa a base de colaboradores — o fechamento mensal da folha (ver
   * Db.gs#payrollSnapshots). Colunas esperadas (normalizadas): matricula,
   * nome, cargo, centro_de_custo, admissao, salario_atual, mes_de_referencia
   * (MM/AAAA, ex.: 08/2026 — o mês que está sendo fechado, lido linha a
   * linha, não um parâmetro do arquivo inteiro). A diretoria é derivada do
   * centro de custo informado (não é mais uma coluna própria). Além de
   * atualizar employees.currentSalary/employees.costCenterId de cada
   * colaborador (como sempre), grava um snapshot na aba FechamentoFolha para
   * o mês daquela linha — reimportar o mesmo (year, month) substitui o
   * snapshot anterior daquele colaborador (idempotente), nunca duplica.
   * Quando este fechamento avança o mês mais recente (não é uma correção de
   * mês antigo), quem estava ATIVO no fechamento anterior e não aparece
   * nesta planilha é automaticamente marcado INATIVO — ver
   * deactivateMissingEmployees_.
   */
  importFromFile: function (base64Data, mimeType, filename, importedByEmail) {
    var records = parseUploadedSpreadsheet_(base64Data, mimeType, filename);
    var errors = [];
    var successRows = 0;
    var seen = {};
    var previousLatest = latestPayrollSnapshotMonth_();
    var employeeIdsByMonthKey = {};

    records.forEach(function (record) {
      var data = record.data;
      var registration = String(data.matricula || '').trim();
      var name = String(data.nome || '').trim();
      var positionName = String(data.cargo || '').trim();
      var costCenterName = String(data.centro_de_custo || '').trim();
      var currentSalary = toNumber_(data.salario_atual);
      var admissionDate = toDateIso_(data.admissao);
      var monthYear = toMonthYear_(data.mes_de_referencia);

      function fail(field, message) {
        errors.push({ rowNumber: record.rowNumber, field: field, message: message });
      }

      if (!registration) return fail('matricula', 'Matrícula é obrigatória');
      if (seen[registration]) return fail('matricula', 'Matrícula duplicada na planilha: ' + registration);
      if (!name) return fail('nome', 'Nome é obrigatório');
      if (!positionName) return fail('cargo', 'Cargo é obrigatório');
      if (!costCenterName) return fail('centro_de_custo', 'Centro de resultado é obrigatório');

      var position = OrgService.findPositionByName(positionName);
      if (!position) return fail('cargo', 'Cargo inexistente: ' + positionName);
      var costCenter = OrgService.findCostCenterByName(costCenterName);
      if (!costCenter) return fail('centro_de_custo', 'Centro de resultado inexistente: ' + costCenterName);
      if (!costCenter.directorateId) {
        return fail(
          'centro_de_custo',
          'Centro de resultado "' + costCenterName + '" não tem diretoria vinculada — cadastre a diretoria dele em Administração > Estrutura Organizacional antes de importar',
        );
      }
      if (currentSalary === null || currentSalary < 0) return fail('salario_atual', 'Salário atual inválido');
      if (!admissionDate) return fail('admissao', 'Data de admissão inválida');
      if (!monthYear) return fail('mes_de_referencia', 'Mês de referência inválido — use o formato MM/AAAA (ex.: 08/2026)');

      seen[registration] = true;

      var existing = Tables.employees.findOne(function (r) {
        return String(r.registration).trim() === registration;
      });

      var payload = {
        registration: registration,
        name: name,
        positionId: position.id,
        directorateId: costCenter.directorateId,
        costCenterId: costCenter.id,
        currentSalary: currentSalary,
        admissionDate: admissionDate,
        status: existing ? existing.status : EmployeeStatus.ATIVO,
        updatedAt: nowIso_(),
      };

      var employeeId;
      if (existing) {
        Tables.employees.update(existing.id, payload);
        employeeId = existing.id;
      } else {
        payload.createdAt = nowIso_();
        employeeId = Tables.employees.insert(payload).id;
      }

      var existingSnapshot = Tables.payrollSnapshots.findOne(function (s) {
        return (
          Number(s.year) === Number(monthYear.year) &&
          Number(s.month) === Number(monthYear.month) &&
          s.employeeId === employeeId
        );
      });
      var snapshotPayload = {
        year: monthYear.year,
        month: monthYear.month,
        employeeId: employeeId,
        directorateId: costCenter.directorateId,
        costCenterId: costCenter.id,
        positionId: position.id,
        salary: currentSalary,
        importBatchId: '',
      };
      if (existingSnapshot) {
        Tables.payrollSnapshots.update(existingSnapshot.id, snapshotPayload);
      } else {
        snapshotPayload.createdAt = nowIso_();
        Tables.payrollSnapshots.insert(snapshotPayload);
      }

      var monthKey = monthYear.year + '-' + monthYear.month;
      if (!employeeIdsByMonthKey[monthKey]) {
        employeeIdsByMonthKey[monthKey] = {
          year: monthYear.year,
          month: monthYear.month,
          keyNum: monthYear.year * 12 + monthYear.month,
          employeeIds: {},
        };
      }
      employeeIdsByMonthKey[monthKey].employeeIds[employeeId] = true;

      successRows += 1;
    });

    var deactivated = [];
    var newestGroup = null;
    Object.keys(employeeIdsByMonthKey).forEach(function (key) {
      var group = employeeIdsByMonthKey[key];
      if (!newestGroup || group.keyNum > newestGroup.keyNum) newestGroup = group;
    });
    if (newestGroup && (!previousLatest || newestGroup.keyNum > previousLatest.keyNum)) {
      deactivated = deactivateMissingEmployees_(previousLatest, newestGroup.employeeIds);
    }

    var batch = logImportBatch_('BASE_COLABORADORES', null, importedByEmail, records.length, successRows, errors);
    return { batch: batch, totalRows: records.length, successRows: successRows, errors: errors, deactivated: deactivated };
  },

  /**
   * Compara a base atual de colaboradores com o orçamento de um mês do ano
   * informado. O orçamento não é vinculado a colaborador — a comparação é
   * sempre feita por centro de custo (nunca por cargo): quantas vagas
   * orçadas existem naquele mês para o centro de custo x quantos
   * colaboradores ativos ocupam esse mesmo centro de custo hoje. Bucketar
   * por cargo faria um cargo estourado e outro com sobra no mesmo centro de
   * custo aparecerem como dois problemas separados (excesso de HC aqui,
   * vaga aberta ali) em vez de simplesmente se cancelarem.
   */
  compareWithBudget: function (year, month, scope) {
    var referenceMonth = month || new Date().getMonth() + 1;
    scope = scope || {};

    var allBudgetEntries = Tables.budgetEntries.where(function (b) {
      if (Number(b.year) !== Number(year)) return false;
      if (!matchesAccessScope_(b, scope)) return false;
      return true;
    });
    var budgetEntries = allBudgetEntries.filter(function (entry) {
      return monthValue_(entry, referenceMonth) !== null;
    });
    var adjustmentRows = BudgetService.listAdjustments(year);

    var monthlySalaries = resolveMonthlySalaryRows_(year, referenceMonth, scope, true);
    var salaryRows = monthlySalaries.rows;

    var directorateNames = indexById_(Tables.directorates.all());
    var costCenterNames = indexById_(Tables.costCenters.all());

    var buckets = {};
    function bucketKey(directorateId, costCenterId) {
      return directorateId + '|' + costCenterId;
    }
    function getBucket(directorateId, costCenterId) {
      var key = bucketKey(directorateId, costCenterId);
      if (!buckets[key]) {
        buckets[key] = {
          directorateId: directorateId,
          directorateName: directorateNames[directorateId] ? directorateNames[directorateId].name : null,
          costCenterId: costCenterId,
          costCenterName: costCenterNames[costCenterId] ? costCenterNames[costCenterId].name : null,
          budgetedCount: 0,
          budgetedCost: 0,
          currentCount: 0,
          currentCost: 0,
        };
      }
      return buckets[key];
    }

    budgetEntries.forEach(function (entry) {
      var bucket = getBucket(entry.directorateId, entry.costCenterId);
      bucket.budgetedCount += 1;
      bucket.budgetedCost += Number(monthValue_(entry, referenceMonth) || 0) * resolveBudgetAdjustmentFactor_(adjustmentRows, entry.directorateId, entry.costCenterId);
    });

    salaryRows.forEach(function (row) {
      if (!row.costCenterId) return;
      var bucket = getBucket(row.directorateId, row.costCenterId);
      bucket.currentCount += 1;
      bucket.currentCost += row.salary;
    });

    var openPositions = 0;
    var headcountExcess = 0;
    var budgetSavings = 0;
    var budgetOverrun = 0;
    var items = [];

    Object.keys(buckets).forEach(function (key) {
      var bucket = buckets[key];
      var countDiff = bucket.budgetedCount - bucket.currentCount;
      if (countDiff > 0) openPositions += countDiff;
      if (countDiff < 0) headcountExcess += Math.abs(countDiff);

      var costDiff = bucket.budgetedCost - bucket.currentCost;
      if (costDiff > 0) budgetSavings += costDiff;
      if (costDiff < 0) budgetOverrun += Math.abs(costDiff);

      if (countDiff !== 0) {
        items.push({
          type: countDiff > 0 ? 'VAGA_ABERTA' : 'EXCESSO_HC',
          directorate: bucket.directorateName,
          costCenter: bucket.costCenterName,
          budgetedCount: bucket.budgetedCount,
          currentCount: bucket.currentCount,
          budgetedCost: bucket.budgetedCost,
          currentCost: bucket.currentCost,
        });
      }
    });

    var movementsByType = {};
    Object.keys(PlannedSituation).forEach(function (key) {
      var type = PlannedSituation[key];
      movementsByType[type] = budgetEntries.filter(function (entry) {
        return entry.movementType === type;
      }).length;
    });

    return {
      year: year,
      month: referenceMonth,
      hcBudgeted: budgetEntries.length,
      hcCurrent: salaryRows.length,
      openPositions: openPositions,
      headcountExcess: headcountExcess,
      budgetSavings: budgetSavings,
      budgetOverrun: budgetOverrun,
      movementsByType: movementsByType,
      items: items,
      monthClosed: monthlySalaries.monthClosed,
    };
  },
};

function indexById_(records) {
  var out = {};
  records.forEach(function (r) {
    out[r.id] = r;
  });
  return out;
}

function shallowCopy_(obj) {
  var copy = {};
  Object.keys(obj).forEach(function (k) {
    copy[k] = obj[k];
  });
  return copy;
}
