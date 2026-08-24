/**
 * Camada de acesso a dados sobre Google Sheets — substitui o
 * TypeORM + PostgreSQL do backend original. Cada "tabela" é uma aba da
 * planilha (linha 1 = cabeçalho = nomes das colunas); cada linha é um
 * registro identificado por uma coluna `id` (UUID).
 *
 * Limitações assumidas conscientemente: sem transações reais, sem FKs
 * impostas pelo banco (validadas em código), leitura via varredura da aba
 * inteira — adequado para a escala de uma planilha de RH (centenas a
 * poucos milhares de linhas), não para milhões de registros.
 */

var SPREADSHEET_ID_PROPERTY = 'SGMS_SPREADSHEET_ID';

function getSpreadsheetId_() {
  var id = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);
  if (!id) {
    throw new Error(
      'Planilha do SGMS ainda não configurada. Execute a função setupSpreadsheet() uma vez ' +
        '(menu Executar > setupSpreadsheet, no editor do Apps Script) antes de usar o sistema.',
    );
  }
  return id;
}

function getDb_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

/**
 * Gera um novo UUID v4 simples (suficiente como chave primária local;
 * não precisa ser criptograficamente forte).
 */
function newId_() {
  return Utilities.getUuid();
}

function nowIso_() {
  return new Date().toISOString();
}

/**
 * Tabela genérica apoiada em uma aba. `columns` define a ordem física das
 * colunas na aba (a primeira deve ser sempre 'id').
 */
function SheetTable(sheetName, columns) {
  this.sheetName = sheetName;
  this.columns = columns;
}

SheetTable.prototype.getSheet_ = function () {
  var sheet = getDb_().getSheetByName(this.sheetName);
  if (!sheet) {
    throw new Error('Aba "' + this.sheetName + '" não encontrada. Rode setupSpreadsheet() novamente.');
  }
  return sheet;
};

SheetTable.prototype.rowToObject_ = function (row, rowIndex) {
  var obj = { _row: rowIndex };
  for (var i = 0; i < this.columns.length; i++) {
    var value = row[i];
    if (value instanceof Date) {
      value = value.toISOString();
    }
    obj[this.columns[i]] = value === '' ? null : value;
  }
  return obj;
};

SheetTable.prototype.objectToRow_ = function (obj) {
  var row = [];
  for (var i = 0; i < this.columns.length; i++) {
    var value = obj[this.columns[i]];
    row.push(value === undefined || value === null ? '' : value);
  }
  return row;
};

/** Retorna todos os registros da aba como array de objetos. */
SheetTable.prototype.all = function () {
  var sheet = this.getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var range = sheet.getRange(2, 1, lastRow - 1, this.columns.length).getValues();
  var out = [];
  for (var i = 0; i < range.length; i++) {
    if (range[i][0] === '' || range[i][0] === null) continue; // linha vazia
    out.push(this.rowToObject_(range[i], i + 2));
  }
  return out;
};

/** Retorna o primeiro registro cujo predicado seja verdadeiro, ou null. */
SheetTable.prototype.findOne = function (predicate) {
  var rows = this.all();
  for (var i = 0; i < rows.length; i++) {
    if (predicate(rows[i])) return rows[i];
  }
  return null;
};

/** Retorna todos os registros que satisfaçam o predicado. */
SheetTable.prototype.where = function (predicate) {
  return this.all().filter(predicate);
};

SheetTable.prototype.get = function (id) {
  return this.findOne(function (r) {
    return r.id === id;
  });
};

/** Insere um novo registro; gera `id` automaticamente se ausente. */
SheetTable.prototype.insert = function (obj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = this.getSheet_();
    if (!obj.id) obj.id = newId_();
    sheet.appendRow(this.objectToRow_(obj));
    return obj;
  } finally {
    lock.releaseLock();
  }
};

/** Atualiza campos de um registro existente (merge parcial). Lança erro se não encontrado. */
SheetTable.prototype.update = function (id, patch) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = this.getSheet_();
    var existing = this.get(id);
    if (!existing) throw new Error('Registro não encontrado em "' + this.sheetName + '": ' + id);
    var merged = {};
    for (var i = 0; i < this.columns.length; i++) {
      var key = this.columns[i];
      merged[key] = patch.hasOwnProperty(key) ? patch[key] : existing[key];
    }
    merged.id = id;
    sheet.getRange(existing._row, 1, 1, this.columns.length).setValues([this.objectToRow_(merged)]);
    return merged;
  } finally {
    lock.releaseLock();
  }
};

/** Insere se não existir registro com esse id, ou atualiza caso exista (upsert por id). */
SheetTable.prototype.upsert = function (obj) {
  if (obj.id && this.get(obj.id)) return this.update(obj.id, obj);
  return this.insert(obj);
};

/** Remove fisicamente a linha (uso raro — a maioria dos fluxos prefere status/active=false). */
SheetTable.prototype.remove = function (id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = this.getSheet_();
    var existing = this.get(id);
    if (!existing) return false;
    sheet.deleteRow(existing._row);
    return true;
  } finally {
    lock.releaseLock();
  }
};

/**
 * Tabelas do sistema — nome da aba e colunas físicas (ordem fixa).
 * Mantido em um único lugar para que Setup.gs e os serviços concordem.
 */
var TABLES_CONFIG = {
  directorates: {
    sheet: 'Diretorias',
    columns: ['id', 'name', 'annualBudget', 'active', 'createdAt'],
  },
  managements: {
    sheet: 'Gerencias',
    columns: ['id', 'directorateId', 'name', 'active', 'createdAt'],
  },
  coordinations: {
    sheet: 'Coordenacoes',
    columns: ['id', 'managementId', 'name', 'active', 'createdAt'],
  },
  positions: {
    sheet: 'Cargos',
    columns: ['id', 'name', 'careerLevel', 'active', 'createdAt'],
  },
  costCenters: {
    sheet: 'CentrosCusto',
    columns: ['id', 'code', 'name', 'directorateId', 'active', 'createdAt'],
  },
  users: {
    sheet: 'Usuarios',
    columns: ['id', 'name', 'email', 'role', 'directorateId', 'active', 'createdAt'],
  },
  employees: {
    sheet: 'Colaboradores',
    columns: [
      'id', 'registration', 'name', 'positionId', 'directorateId', 'managementId',
      'coordinationId', 'costCenterId', 'city', 'state', 'contractType',
      'admissionDate', 'currentSalary', 'status', 'createdAt', 'updatedAt',
    ],
  },
  budgetEntries: {
    sheet: 'Orcamento',
    columns: [
      'id', 'year', 'registration', 'employeeId', 'name', 'positionId', 'directorateId',
      'city', 'state', 'contractType', 'admissionDate', 'currentSalary',
      'plannedSituation', 'plannedSalary', 'plannedMonth', 'monthlyBudgetedCost',
      'annualBudgetedCost', 'createdAt',
    ],
  },
  chargeParameters: {
    sheet: 'EncargosParametros',
    columns: ['id', 'name', 'label', 'valueType', 'value', 'isBenefit', 'active', 'createdAt'],
  },
  movementRequests: {
    sheet: 'Movimentacoes',
    columns: [
      'id', 'type', 'status', 'employeeId', 'directorateId', 'currentPositionId', 'newPositionId',
      'currentSalary', 'newSalary', 'meritPercentage', 'quantity', 'plannedSalary',
      'originDirectorateId', 'destinationDirectorateId', 'effectiveDate', 'justification',
      'requestedByEmail', 'createdAt', 'updatedAt',
    ],
  },
  movementSimulations: {
    sheet: 'Simulacoes',
    columns: [
      'id', 'movementRequestId', 'monthsRemaining', 'monthlySalaryImpact', 'annualSalaryImpact',
      'chargesTotal', 'benefitsTotal', 'totalMonthlyImpact', 'totalAnnualImpact',
      'budgetedDirectoratePayroll', 'currentDirectoratePayroll', 'payrollAfterApproval',
      'difference', 'percentConsumed', 'exceedsBudget', 'alertMessage', 'createdAt',
    ],
  },
  approvalSteps: {
    sheet: 'AprovacaoEtapas',
    columns: [
      'id', 'movementRequestId', 'stepOrder', 'approverRole', 'approverEmail',
      'status', 'comment', 'decidedAt', 'createdAt',
    ],
  },
  movementHistory: {
    sheet: 'Historico',
    columns: [
      'id', 'movementRequestId', 'employeeId', 'type', 'directorateId', 'positionId',
      'costCenterId', 'previousSalary', 'newSalary', 'effectiveDate', 'approvedAt',
      'monthlyImpact', 'annualImpact', 'createdAt',
    ],
  },
  salaryStudies: {
    sheet: 'EstudosSalariais',
    columns: ['id', 'name', 'source', 'referenceYear', 'importedByEmail', 'createdAt'],
  },
  salaryStudyEntries: {
    sheet: 'EstudosSalariaisItens',
    columns: [
      'id', 'studyId', 'positionId', 'companyName', 'minSalary', 'avgSalary',
      'maxSalary', 'p25', 'p50', 'p75', 'p90', 'createdAt',
    ],
  },
  importLog: {
    sheet: 'LogImportacao',
    columns: [
      'id', 'type', 'referenceYear', 'importedByEmail', 'totalRows', 'successRows',
      'errorRows', 'errorsJson', 'createdAt',
    ],
  },
  auditLog: {
    sheet: 'LogAuditoria',
    columns: ['id', 'userEmail', 'action', 'entity', 'entityId', 'detailsJson', 'createdAt'],
  },
};

var _tableInstances_ = {};

/** Fábrica de acesso: Tables.employees.all(), Tables.movementRequests.insert(...), etc. */
var Tables = (function () {
  var proxy = {};
  Object.keys(TABLES_CONFIG).forEach(function (key) {
    Object.defineProperty(proxy, key, {
      get: function () {
        if (!_tableInstances_[key]) {
          var cfg = TABLES_CONFIG[key];
          _tableInstances_[key] = new SheetTable(cfg.sheet, cfg.columns);
        }
        return _tableInstances_[key];
      },
    });
  });
  return proxy;
})();

function recordAudit_(userEmail, action, entity, entityId, details) {
  try {
    Tables.auditLog.insert({
      userEmail: userEmail || '',
      action: action,
      entity: entity,
      entityId: entityId || '',
      detailsJson: details ? JSON.stringify(details) : '',
      createdAt: nowIso_(),
    });
  } catch (e) {
    Logger.log('Falha ao gravar auditoria: ' + e);
  }
}
