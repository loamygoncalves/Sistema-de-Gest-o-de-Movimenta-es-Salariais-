/**
 * Estrutura organizacional: diretorias, gerências, coordenações, cargos e
 * centros de custo. Espelha backend/src/modules/org.
 */

var OrgService = {
  listDirectorates: function () {
    return Tables.directorates.all().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },

  getDirectorate: function (id) {
    var d = Tables.directorates.get(id);
    if (!d) throw new Error('Diretoria não encontrada: ' + id);
    return d;
  },

  findDirectorateByName: function (name) {
    return Tables.directorates.findOne(function (r) {
      return r.name === name;
    });
  },

  createDirectorate: function (input) {
    return Tables.directorates.insert({
      name: input.name,
      annualBudget: Number(input.annualBudget || 0),
      active: true,
      createdAt: nowIso_(),
    });
  },

  updateDirectorate: function (id, input) {
    return Tables.directorates.update(id, input);
  },

  listManagements: function (directorateId) {
    return Tables.managements.where(function (r) {
      return !directorateId || r.directorateId === directorateId;
    });
  },

  createManagement: function (input) {
    return Tables.managements.insert({
      directorateId: input.directorateId,
      name: input.name,
      active: true,
      createdAt: nowIso_(),
    });
  },

  listCoordinations: function (managementId) {
    return Tables.coordinations.where(function (r) {
      return !managementId || r.managementId === managementId;
    });
  },

  createCoordination: function (input) {
    return Tables.coordinations.insert({
      managementId: input.managementId,
      name: input.name,
      active: true,
      createdAt: nowIso_(),
    });
  },

  listPositions: function () {
    return Tables.positions.all().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },

  getPosition: function (id) {
    var p = Tables.positions.get(id);
    if (!p) throw new Error('Cargo não encontrado: ' + id);
    return p;
  },

  findPositionByName: function (name) {
    return Tables.positions.findOne(function (r) {
      return r.name === name;
    });
  },

  createPosition: function (input) {
    return Tables.positions.insert({
      name: input.name,
      careerLevel: input.careerLevel || '',
      active: true,
      createdAt: nowIso_(),
    });
  },

  updatePosition: function (id, input) {
    return Tables.positions.update(id, input);
  },

  listCostCenters: function () {
    return Tables.costCenters.all().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },

  findCostCenterByName: function (name) {
    return Tables.costCenters.findOne(function (r) {
      return r.name === name;
    });
  },

  createCostCenter: function (input) {
    return Tables.costCenters.insert({
      code: input.code,
      name: input.name,
      directorateId: input.directorateId || '',
      active: true,
      createdAt: nowIso_(),
    });
  },

  /**
   * Cadastro de centros de custo em massa a partir de uma planilha contendo
   * apenas os nomes (uma coluna) — equivalente a
   * backend/src/modules/org/org.service.ts#importCostCentersFromExcel.
   * Aceita um cabeçalho reconhecido (NOME, CENTRO DE CUSTO, ...) na primeira
   * linha; se não bater com nenhum alias conhecido, a própria primeira linha
   * é tratada como dado (planilha sem cabeçalho). O `code` — exigido pelo
   * cadastro mas ausente na planilha — é gerado a partir do nome.
   */
  importCostCentersFromFile: function (base64Data, mimeType, filename, importedByEmail) {
    var sheet = parseUploadedSpreadsheetRaw_(base64Data, mimeType, filename);
    var headers = sheet.headers;
    var rows = sheet.rows;

    var nameAliases = ['NOME', 'CENTRO DE CUSTO', 'CENTRO_DE_CUSTO', 'CENTROS DE CUSTO'];
    var hasRecognizedHeader = nameAliases.indexOf(normalizeCostCenterLabel_(headers[0])) !== -1;
    var dataRows = hasRecognizedHeader ? rows : [{ rowNumber: 1, values: headers }].concat(rows);

    var existing = this.listCostCenters();
    var existingNames = {};
    existing.forEach(function (c) {
      existingNames[normalizeCostCenterLabel_(c.name)] = true;
    });
    var usedCodes = {};
    existing.forEach(function (c) {
      usedCodes[c.code] = true;
    });
    var seenInFile = {};

    var errors = [];
    var successRows = 0;

    dataRows.forEach(function (row) {
      var name = String(row.values[0] || '').trim();
      if (!name) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: 'Nome é obrigatório' });
        return;
      }
      var key = normalizeCostCenterLabel_(name);
      if (seenInFile[key]) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: 'Nome duplicado na planilha: ' + name });
        return;
      }
      if (existingNames[key]) {
        errors.push({ rowNumber: row.rowNumber, field: 'nome', message: 'Centro de custo já cadastrado: ' + name });
        return;
      }
      seenInFile[key] = true;
      var code = generateCostCenterCode_(name, usedCodes);
      usedCodes[code] = true;
      Tables.costCenters.insert({
        code: code,
        name: name,
        directorateId: '',
        active: true,
        createdAt: nowIso_(),
      });
      successRows += 1;
    });

    var batch = logImportBatch_('CENTRO_CUSTO', null, importedByEmail, dataRows.length, successRows, errors);
    return { batch: batch, totalRows: dataRows.length, successRows: successRows, errors: errors };
  },
};

function normalizeCostCenterLabel_(value) {
  return String(value === null || value === undefined ? '' : value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Gera um código único a partir do nome (planilha traz só o nome, mas o
 * cadastro exige um `code` único) — desambigua com sufixo numérico contra os
 * códigos já usados (existentes + já gerados nesta importação).
 */
function generateCostCenterCode_(name, usedCodes) {
  var base = normalizeCostCenterLabel_(name)
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 45);
  if (!base) base = 'CC';
  var code = base;
  var suffix = 2;
  while (usedCodes[code]) {
    code = (base + '_' + suffix).slice(0, 50);
    suffix += 1;
  }
  return code;
}
