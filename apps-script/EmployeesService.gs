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

  /** Compara a base atual de colaboradores com o orçamento do ano informado. */
  compareWithBudget: function (year, scopedDirectorateId) {
    var budgetEntries = Tables.budgetEntries.where(function (b) {
      return Number(b.year) === Number(year) && (!scopedDirectorateId || b.directorateId === scopedDirectorateId);
    });
    var employees = Tables.employees.where(function (e) {
      return !scopedDirectorateId || e.directorateId === scopedDirectorateId;
    });

    var employeesByRegistration = {};
    employees.forEach(function (e) {
      employeesByRegistration[e.registration] = e;
    });

    var promotionsDone = 0;
    var promotionsPending = 0;
    var budgetSavings = 0;
    var budgetOverrun = 0;
    var items = [];

    budgetEntries.forEach(function (budget) {
      if (budget.plannedSituation === PlannedSituation.NOVA_VAGA) {
        items.push({
          type: 'VAGA_ABERTA',
          registration: budget.registration,
          name: budget.name,
          plannedSalary: budget.plannedSalary,
        });
        return;
      }

      var employee = budget.registration ? employeesByRegistration[budget.registration] : null;
      if (!employee) return;

      if (budget.plannedSituation === PlannedSituation.PROMOCAO) {
        if (Number(employee.currentSalary) >= Number(budget.plannedSalary)) {
          promotionsDone += 1;
        } else {
          promotionsPending += 1;
          items.push({
            type: 'PROMOCAO_PENDENTE',
            registration: employee.registration,
            name: employee.name,
            currentSalary: employee.currentSalary,
            plannedSalary: budget.plannedSalary,
          });
        }
      }

      var diff = Number(budget.currentSalary) - Number(employee.currentSalary);
      if (diff > 0) budgetSavings += diff;
      if (diff < 0) budgetOverrun += Math.abs(diff);
    });

    var openPositions = budgetEntries.filter(function (b) {
      return b.plannedSituation === PlannedSituation.NOVA_VAGA;
    }).length;

    var headcountExcess = Math.max(0, employees.length - budgetEntries.length);

    return {
      hcBudgeted: budgetEntries.length,
      hcCurrent: employees.length,
      promotionsDone: promotionsDone,
      promotionsPending: promotionsPending,
      openPositions: openPositions,
      headcountExcess: headcountExcess,
      budgetSavings: budgetSavings,
      budgetOverrun: budgetOverrun,
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
