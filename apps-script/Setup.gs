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
