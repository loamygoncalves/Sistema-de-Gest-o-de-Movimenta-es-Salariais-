/**
 * Base atual de colaboradores — espelha backend/src/modules/employees.
 */

var EmployeesService = {
  list: function (filters, scopedDirectorateId) {
    filters = filters || {};
    var directorateId = scopedDirectorateId || filters.directorateId;
    var search = filters.search ? String(filters.search).toLowerCase() : null;

    var items = Tables.employees.where(function (e) {
      if (directorateId && e.directorateId !== directorateId) return false;
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
   * Importa a base atual de colaboradores. Colunas esperadas (normalizadas):
   * matricula, nome, cargo, diretoria, cidade, estado, tipo_contrato,
   * data_admissao, salario_atual, status.
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
      var directorateName = String(data.diretoria || '').trim();
      var currentSalary = toNumber_(data.salario_atual);
      var admissionDate = toDateIso_(data.data_admissao);

      function fail(field, message) {
        errors.push({ rowNumber: record.rowNumber, field: field, message: message });
      }

      if (!registration) return fail('matricula', 'Matrícula é obrigatória');
      if (seen[registration]) return fail('matricula', 'Matrícula duplicada na planilha: ' + registration);
      if (!name) return fail('nome', 'Nome é obrigatório');
      if (!positionName) return fail('cargo', 'Cargo é obrigatório');
      if (!directorateName) return fail('diretoria', 'Diretoria é obrigatória');

      var position = OrgService.findPositionByName(positionName);
      if (!position) return fail('cargo', 'Cargo inexistente: ' + positionName);
      var directorate = OrgService.findDirectorateByName(directorateName);
      if (!directorate) return fail('diretoria', 'Diretoria inexistente: ' + directorateName);
      if (currentSalary === null || currentSalary < 0) return fail('salario_atual', 'Salário atual inválido');
      if (!admissionDate) return fail('data_admissao', 'Data de admissão inválida');

      seen[registration] = true;

      var statusRaw = String(data.status || 'ATIVO').trim().toUpperCase();
      var status = EmployeeStatus[statusRaw] ? statusRaw : EmployeeStatus.ATIVO;

      var existing = Tables.employees.findOne(function (r) {
        return r.registration === registration;
      });

      var payload = {
        registration: registration,
        name: name,
        positionId: position.id,
        directorateId: directorate.id,
        currentSalary: currentSalary,
        admissionDate: admissionDate,
        status: status,
        updatedAt: nowIso_(),
      };

      if (existing) {
        Tables.employees.update(existing.id, payload);
      } else {
        payload.createdAt = nowIso_();
        Tables.employees.insert(payload);
      }
      successRows += 1;
    });

    var batch = logImportBatch_('BASE_COLABORADORES', null, importedByEmail, records.length, successRows, errors);
    return { batch: batch, totalRows: records.length, successRows: successRows, errors: errors };
  },

  /**
   * Compara a base atual de colaboradores com o orçamento de um mês do ano
   * informado. O orçamento não é vinculado a colaborador — a comparação é
   * feita por "bucket" (diretoria + centro de custo + cargo): quantas vagas
   * orçadas existem naquele mês para o bucket x quantos colaboradores
   * ativos ocupam esse mesmo bucket hoje.
   */
  compareWithBudget: function (year, month, scopedDirectorateId) {
    var referenceMonth = month || new Date().getMonth() + 1;

    var allBudgetEntries = Tables.budgetEntries.where(function (b) {
      if (Number(b.year) !== Number(year)) return false;
      if (scopedDirectorateId && b.directorateId !== scopedDirectorateId) return false;
      return true;
    });
    var budgetEntries = allBudgetEntries.filter(function (entry) {
      return monthValue_(entry, referenceMonth) !== null;
    });

    var employees = Tables.employees.where(function (e) {
      if (e.status !== EmployeeStatus.ATIVO) return false;
      if (scopedDirectorateId && e.directorateId !== scopedDirectorateId) return false;
      return true;
    });

    var directorateNames = indexById_(Tables.directorates.all());
    var costCenterNames = indexById_(Tables.costCenters.all());
    var positionNames = indexById_(Tables.positions.all());

    var buckets = {};
    function bucketKey(directorateId, costCenterId, positionId) {
      return directorateId + '|' + costCenterId + '|' + positionId;
    }
    function getBucket(directorateId, costCenterId, positionId) {
      var key = bucketKey(directorateId, costCenterId, positionId);
      if (!buckets[key]) {
        buckets[key] = {
          directorateId: directorateId,
          directorateName: directorateNames[directorateId] ? directorateNames[directorateId].name : null,
          costCenterId: costCenterId,
          costCenterName: costCenterNames[costCenterId] ? costCenterNames[costCenterId].name : null,
          positionId: positionId,
          positionName: positionNames[positionId] ? positionNames[positionId].name : null,
          budgetedCount: 0,
          budgetedCost: 0,
          currentCount: 0,
          currentCost: 0,
        };
      }
      return buckets[key];
    }

    budgetEntries.forEach(function (entry) {
      var bucket = getBucket(entry.directorateId, entry.costCenterId, entry.positionId);
      bucket.budgetedCount += 1;
      bucket.budgetedCost += Number(monthValue_(entry, referenceMonth) || 0);
    });

    employees.forEach(function (employee) {
      if (!employee.costCenterId) return;
      var bucket = getBucket(employee.directorateId, employee.costCenterId, employee.positionId);
      bucket.currentCount += 1;
      bucket.currentCost += Number(employee.currentSalary || 0);
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
          position: bucket.positionName,
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
      hcCurrent: employees.length,
      openPositions: openPositions,
      headcountExcess: headcountExcess,
      budgetSavings: budgetSavings,
      budgetOverrun: budgetOverrun,
      movementsByType: movementsByType,
      items: items,
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
