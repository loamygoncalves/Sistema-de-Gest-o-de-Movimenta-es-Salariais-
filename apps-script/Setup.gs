/**
 * Rotina de instalação — execute UMA VEZ (menu Executar > setupSpreadsheet,
 * no editor do Apps Script, ou via `clasp run setupSpreadsheet`) para:
 *   1. criar a planilha "BEEP Remunera - Banco de Dados" com todas as abas/cabeçalhos;
 *   2. guardar o ID dela em Script Properties (é isso que Db.gs usa depois);
 *   3. semear diretorias, cargos, centros de custo e encargos de exemplo;
 *   4. cadastrar quem executou o setup como usuário ADMIN.
 *
 * Rodar de novo é seguro: abas existentes não são recriadas, e o seed só
 * insere o que ainda não existe (equivalente a backend/src/database/seed.ts).
 */
function setupSpreadsheet() {
  var existingId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);
  var ss;
  if (existingId) {
    ss = SpreadsheetApp.openById(existingId);
  } else {
    ss = SpreadsheetApp.create('BEEP Remunera - Banco de Dados');
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_PROPERTY, ss.getId());
  }

  migrateLegacyBudgetSheet_(ss);
  migrateUsersSheet_(ss);
  migrateMovementRequestsSheet_(ss);

  Object.keys(TABLES_CONFIG).forEach(function (key) {
    var cfg = TABLES_CONFIG[key];
    var sheet = ss.getSheetByName(cfg.sheet);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.sheet);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, cfg.columns.length).setValues([cfg.columns]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, cfg.columns.length).setFontWeight('bold');
    }
  });

  // A aba padrão "Sheet1" criada pelo SpreadsheetApp.create fica sem uso.
  var blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1');
  if (blank && ss.getSheets().length > 1) {
    ss.deleteSheet(blank);
  }

  seedReferenceData_();
  seedAdminUser_();

  Logger.log('Planilha configurada: ' + ss.getUrl());
  return ss.getUrl();
}

/**
 * Migração de segurança: o modelo do orçamento mudou de "uma linha por
 * colaborador" (registration/plannedSalary/plannedMonth/...) para "uma
 * linha por diretoria+centro de custo+cargo+tipo de movimentação" com 12
 * colunas mensais (jan..dez). Se a aba de orçamento já existir com o
 * cabeçalho antigo, ela é renomeada (nunca apagada) e uma aba nova com o
 * cabeçalho atual é criada em seu lugar pelo loop principal de
 * setupSpreadsheet(), para que ninguém perca dados silenciosamente.
 */
function migrateLegacyBudgetSheet_(ss) {
  var cfg = TABLES_CONFIG.budgetEntries;
  var sheet = ss.getSheetByName(cfg.sheet);
  if (!sheet || sheet.getLastRow() === 0) return;

  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var matches =
    currentHeaders.length === cfg.columns.length &&
    cfg.columns.every(function (col, i) {
      return currentHeaders[i] === col;
    });
  if (matches) return;

  var legacyName = cfg.sheet + '_legado_' + new Date().getTime();
  sheet.setName(legacyName);
  Logger.log(
    'Aba "' +
      cfg.sheet +
      '" com layout antigo de orçamento (por colaborador) renomeada para "' +
      legacyName +
      '" — dados preservados ali. Uma aba "' +
      cfg.sheet +
      '" nova, com o layout atual (diretoria+centro de custo+cargo+tipo de movimentação+jan..dez), será criada em seguida.',
  );
}

/**
 * Migração genérica de layout: quando o cabeçalho atual de uma aba não bate
 * com TABLES_CONFIG (colunas novas adicionadas/removidas), reescreve a aba
 * preservando os dados por NOME de coluna — colunas que deixaram de existir
 * são descartadas, colunas novas ficam vazias. `transformRow` (opcional)
 * recebe cada registro (objeto por nome de coluna antigo) e pode ajustá-lo
 * ou devolver null para descartar a linha inteira. Diferente de
 * migrateLegacyBudgetSheet_ (que apenas renomeia a aba antiga para o lado),
 * usada quando o remapeamento por nome é suficiente para não perder dados.
 */
function migrateSheetColumns_(ss, tableKey, transformRow) {
  var cfg = TABLES_CONFIG[tableKey];
  var sheet = ss.getSheetByName(cfg.sheet);
  if (!sheet || sheet.getLastRow() === 0) return;

  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var matches =
    currentHeaders.length === cfg.columns.length &&
    cfg.columns.every(function (col, i) {
      return currentHeaders[i] === col;
    });
  if (matches) return;

  var lastRow = sheet.getLastRow();
  var oldRows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, currentHeaders.length).getValues() : [];

  var records = [];
  oldRows.forEach(function (row) {
    if (row[0] === '' || row[0] === null) return;
    var obj = {};
    currentHeaders.forEach(function (header, i) {
      obj[header] = row[i];
    });
    if (transformRow) obj = transformRow(obj);
    if (obj) records.push(obj);
  });

  sheet.clear();
  sheet.getRange(1, 1, 1, cfg.columns.length).setValues([cfg.columns]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, cfg.columns.length).setFontWeight('bold');

  if (records.length > 0) {
    var newRows = records.map(function (obj) {
      return cfg.columns.map(function (col) {
        var value = obj[col];
        return value === undefined || value === null ? '' : value;
      });
    });
    sheet.getRange(2, 1, newRows.length, cfg.columns.length).setValues(newRows);
  }

  Logger.log('Aba "' + cfg.sheet + '" migrada para o novo layout (' + records.length + ' registro(s) preservado(s)).');
}

/** Usuarios ganhou costCenterIds/passwordSalt/passwordHash — dados existentes são preservados como estão. */
function migrateUsersSheet_(ss) {
  migrateSheetColumns_(ss, 'users', function (obj) {
    return obj;
  });
}

/**
 * Movimentacoes perdeu originDirectorateId/destinationDirectorateId (fim da
 * Transferência) e ganhou costCenterId. Solicitações de transferência são
 * descartadas (junto com simulações/etapas de aprovação/histórico
 * dependentes) — equivalente à migration TypeORM
 * RemoveTransferAddMovementCostCenter no backend NestJS. Para as demais,
 * tenta recuperar o centro de custo a partir do colaborador vinculado.
 */
function migrateMovementRequestsSheet_(ss) {
  var removedIds = {};
  migrateSheetColumns_(ss, 'movementRequests', function (obj) {
    if (obj.type === 'TRANSFERENCIA') {
      removedIds[obj.id] = true;
      return null;
    }
    if (!obj.costCenterId && obj.employeeId) {
      var employee = Tables.employees.get(obj.employeeId);
      obj.costCenterId = employee ? employee.costCenterId || '' : '';
    }
    return obj;
  });

  var removedIdList = Object.keys(removedIds);
  if (removedIdList.length === 0) return;

  ['movementSimulations', 'approvalSteps', 'movementHistory'].forEach(function (tableKey) {
    var table = Tables[tableKey];
    var toRemove = table.where(function (r) {
      return removedIds.hasOwnProperty(r.movementRequestId);
    });
    toRemove.forEach(function (r) {
      table.remove(r.id);
    });
  });

  Logger.log(removedIdList.length + ' solicitação(ões) de Transferência removida(s) (funcionalidade descontinuada).');
}

function seedReferenceData_() {
  var directorateNames = [
    { name: 'Diretoria Comercial', annualBudget: 12000000 },
    { name: 'Diretoria de Operações', annualBudget: 18000000 },
    { name: 'Diretoria Financeira', annualBudget: 6000000 },
    { name: 'Diretoria de Tecnologia', annualBudget: 15000000 },
    { name: 'Diretoria de Gente e Gestão', annualBudget: 5000000 },
  ];
  directorateNames.forEach(function (d) {
    var existing = Tables.directorates.findOne(function (r) {
      return r.name === d.name;
    });
    if (!existing) {
      Tables.directorates.insert({
        name: d.name,
        annualBudget: d.annualBudget,
        active: true,
        createdAt: nowIso_(),
      });
    }
  });

  var positionNames = ['Analista I', 'Analista II', 'Analista III', 'Especialista', 'Coordenador', 'Gerente', 'Diretor'];
  positionNames.forEach(function (name) {
    var existing = Tables.positions.findOne(function (r) {
      return r.name === name;
    });
    if (!existing) {
      Tables.positions.insert({ name: name, active: true, createdAt: nowIso_() });
    }
  });

  var costCenters = [
    { code: 'CC-001', name: 'Comercial SP' },
    { code: 'CC-002', name: 'Operações RJ' },
    { code: 'CC-003', name: 'Financeiro Corporativo' },
    { code: 'CC-004', name: 'Tecnologia' },
  ];
  costCenters.forEach(function (cc) {
    var existing = Tables.costCenters.findOne(function (r) {
      return r.code === cc.code;
    });
    if (!existing) {
      Tables.costCenters.insert({ code: cc.code, name: cc.name, active: true, createdAt: nowIso_() });
    }
  });

  var chargeParams = [
    { name: 'INSS_PATRONAL', label: 'INSS Patronal', valueType: ChargeValueType.PERCENTUAL, value: 20, isBenefit: false },
    { name: 'FGTS', label: 'FGTS', valueType: ChargeValueType.PERCENTUAL, value: 8, isBenefit: false },
    { name: 'FERIAS', label: 'Férias + 1/3', valueType: ChargeValueType.PERCENTUAL, value: 11.11, isBenefit: false },
    { name: 'DECIMO_TERCEIRO', label: '13º Salário', valueType: ChargeValueType.PERCENTUAL, value: 8.33, isBenefit: false },
    { name: 'BENEFICIOS', label: 'Benefícios (VR/VA/Saúde)', valueType: ChargeValueType.FIXO, value: 850, isBenefit: true },
  ];
  chargeParams.forEach(function (cp) {
    var existing = Tables.chargeParameters.findOne(function (r) {
      return r.name === cp.name;
    });
    if (!existing) {
      Tables.chargeParameters.insert({
        name: cp.name,
        label: cp.label,
        valueType: cp.valueType,
        value: cp.value,
        isBenefit: cp.isBenefit,
        active: true,
        createdAt: nowIso_(),
      });
    }
  });
}

/** Cadastra quem executou o setup (Session.getEffectiveUser()) como ADMIN. */
function seedAdminUser_() {
  var email = Session.getEffectiveUser().getEmail();
  if (!email) return;
  var existing = Tables.users.findOne(function (r) {
    return r.email === email;
  });
  if (!existing) {
    Tables.users.insert({
      name: email.split('@')[0],
      email: email,
      role: UserRole.ADMIN,
      directorateId: '',
      active: true,
      createdAt: nowIso_(),
    });
    Logger.log('Usuário ADMIN criado para ' + email);
  }
}

/**
 * Utilitário para apontar o sistema para uma planilha já existente (ex.:
 * ao mover o projeto para outra conta). Passe o ID da planilha (parte da
 * URL entre /d/ e /edit).
 */
function useExistingSpreadsheet(spreadsheetId) {
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_PROPERTY, spreadsheetId);
  setupSpreadsheet();
}
