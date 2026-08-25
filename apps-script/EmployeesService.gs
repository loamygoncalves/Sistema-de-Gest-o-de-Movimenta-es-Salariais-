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
  scope = scope || {};
  var directorateNames = indexById_(Tables.directorates.all());

  var snapshots = Tables.payrollSnapshots.where(function (s) {
    if (Number(s.year) !== Number(year) || Number(s.month) !== Number(month)) return false;
    if (!matchesAccessScope_(s, scope)) return false;
    return true;
  });
  if (snapshots.length === 0) {
    return { rows: [], monthClosed: false };
  }
  return {
    rows: snapshots.map(function (s) {
      return {
        directorateId: s.directorateId,
        directorateName: directorateNames[s.directorateId] ? directorateNames[s.directorateId].name : null,
        costCenterId: s.costCenterId || '',
        salary: Number(s.salary || 0),
      };
    }),
    monthClosed: true,
  };
}

var EmployeesService = {
  list: function (filters, scope) {
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

    return this._withRelations(items);
  },

  get: function (id) {
    var e = Tables.employees.get(id);
    if (!e) throw new Error('Colaborador não encontrado: ' + id);
    return this._withRelations([e])[0];
  },

  _withRelations: function (employees) {
    var positions = indexById_(Tables.positions.all());
    var directorates = indexById_(Tables.directorates.all());
    return employees.map(function (e) {
      var copy = shallowCopy_(e);
      copy.positionName = positions[e.positionId] ? positions[e.positionId].name : null;
      copy.directorateName = directorates[e.directorateId] ? directorates[e.directorateId].name : null;
      return copy;
    });
  },

  create: function (input) {
    var existing = Tables.employees.findOne(function (r) {
      return r.registration === input.registration;
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
   */
  importFromFile: function (base64Data, mimeType, filename, importedByEmail) {
    var records = parseUploadedSpreadsheet_(base64Data, mimeType, filename);
    var errors = [];
    var successRows = 0;
    var seen = {};

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
      if (!costCenterName) return fail('centro_de_custo', 'Centro de custo é obrigatório');

      var position = OrgService.findPositionByName(positionName);
      if (!position) return fail('cargo', 'Cargo inexistente: ' + positionName);
      var costCenter = OrgService.findCostCenterByName(costCenterName);
      if (!costCenter) return fail('centro_de_custo', 'Centro de custo inexistente: ' + costCenterName);
      if (!costCenter.directorateId) {
        return fail(
          'centro_de_custo',
          'Centro de custo "' + costCenterName + '" não tem diretoria vinculada — cadastre a diretoria dele em Administração > Estrutura Organizacional antes de importar',
        );
      }
      if (currentSalary === null || currentSalary < 0) return fail('salario_atual', 'Salário atual inválido');
      if (!admissionDate) return fail('admissao', 'Data de admissão inválida');
      if (!monthYear) return fail('mes_de_referencia', 'Mês de referência inválido — use o formato MM/AAAA (ex.: 08/2026)');

      seen[registration] = true;

      var existing = Tables.employees.findOne(function (r) {
        return r.registration === registration;
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

      successRows += 1;
    });

    var batch = logImportBatch_('BASE_COLABORADORES', null, importedByEmail, records.length, successRows, errors);
    return { batch: batch, totalRows: records.length, successRows: successRows, errors: errors };
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
      bucket.budgetedCost += Number(monthValue_(entry, referenceMonth) || 0);
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
