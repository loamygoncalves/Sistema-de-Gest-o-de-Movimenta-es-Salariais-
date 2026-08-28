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
   * Exclusão definitiva (não há tela de reativação para centro de custo, e
   * `code` é único — mantê-lo "preso" para sempre não ajudaria ninguém).
   * Centros de custo referenciados no orçamento não podem ser excluídos —
   * equivalente ao FK RESTRICT do backend NestJS.
   */
  removeCostCenter: function (id) {
    var inUse = Tables.budgetEntries.findOne(function (b) {
      return b.costCenterId === id;
    });
    if (inUse) throw new Error('Centro de resultado em uso no orçamento — não pode ser excluído.');
    var removed = Tables.costCenters.remove(id);
    if (!removed) throw new Error('Centro de resultado não encontrado');
  },

  removeCostCenters: function (ids) {
    var removedIds = [];
    var failed = [];
    ids.forEach(function (id) {
      var inUse = Tables.budgetEntries.findOne(function (b) {
        return b.costCenterId === id;
      });
      if (inUse) {
        failed.push({ id: id, message: 'Centro de resultado em uso no orçamento — não pode ser excluído.' });
        return;
      }
      var removed = Tables.costCenters.remove(id);
      if (removed) removedIds.push(id);
      else failed.push({ id: id, message: 'Centro de resultado não encontrado' });
    });
    return { removed: removedIds.length, removedIds: removedIds, failed: failed };
  },

  /**
   * Cadastro de centros de custo em massa a partir de uma planilha com as
   * colunas CÓDIGO, CENTRO DE CUSTO e DIRETORIA (opcional — quando
   * informada, é resolvida por nome exato) — equivalente a
   * backend/src/modules/org/org.service.ts#importCostCentersFromExcel.
   * Rejeita código/nome vazio ou duplicado (na planilha ou já cadastrado) e
   * diretoria informada mas inexistente.
   */
  importCostCentersFromFile: function (base64Data, mimeType, filename, importedByEmail) {
    var sheet = parseUploadedSpreadsheetRaw_(base64Data, mimeType, filename);
    var headers = sheet.headers;
    var rows = sheet.rows;

    var codeAliases = ['CODIGO', 'CÓDIGO'];
    var nameAliases = ['CENTRO DE RESULTADO', 'CENTRO_DE_RESULTADO', 'CENTRO DE CUSTO', 'CENTRO_DE_CUSTO', 'NOME'];
    var directorateAliases = ['DIRETORIA'];

    function findHeaderIndex(aliases) {
      for (var i = 0; i < headers.length; i++) {
        if (aliases.indexOf(normalizeCostCenterLabel_(headers[i])) !== -1) return i;
      }
      return -1;
    }

    var codeIdx = findHeaderIndex(codeAliases);
    var nameIdx = findHeaderIndex(nameAliases);
    var directorateIdx = findHeaderIndex(directorateAliases);

    if (codeIdx === -1 || nameIdx === -1) {
      var missing = [];
      if (codeIdx === -1) missing.push('código');
      if (nameIdx === -1) missing.push('centro de resultado');
      throw new Error(
        'Planilha inválida: coluna(s) não encontrada(s): ' +
          missing.join(', ') +
          '. Esperado: CÓDIGO, CENTRO DE RESULTADO, DIRETORIA (opcional).',
      );
    }

    var existing = this.listCostCenters();
    var existingNames = {};
    var existingCodes = {};
    existing.forEach(function (c) {
      existingNames[normalizeCostCenterLabel_(c.name)] = true;
      existingCodes[normalizeCostCenterLabel_(c.code)] = true;
    });
    var seenNames = {};
    var seenCodes = {};

    var errors = [];
    var successRows = 0;
    var orgService = this;

    rows.forEach(function (row) {
      var code = String(row.values[codeIdx] || '').trim();
      var name = String(row.values[nameIdx] || '').trim();
      var directorateName = directorateIdx === -1 ? '' : String(row.values[directorateIdx] || '').trim();

      function fail(field, message) {
        errors.push({ rowNumber: row.rowNumber, field: field, message: message });
      }

      if (!code) return fail('codigo', 'Código é obrigatório');
      if (!name) return fail('nome', 'Nome é obrigatório');

      var codeKey = normalizeCostCenterLabel_(code);
      var nameKey = normalizeCostCenterLabel_(name);
      if (seenCodes[codeKey]) return fail('codigo', 'Código duplicado na planilha: ' + code);
      if (existingCodes[codeKey]) return fail('codigo', 'Código já cadastrado: ' + code);
      if (seenNames[nameKey]) return fail('nome', 'Nome duplicado na planilha: ' + name);
      if (existingNames[nameKey]) return fail('nome', 'Centro de resultado já cadastrado: ' + name);

      var directorateId = '';
      if (directorateName) {
        var directorate = orgService.findDirectorateByName(directorateName);
        if (!directorate) return fail('diretoria', 'Diretoria inexistente: ' + directorateName);
        directorateId = directorate.id;
      }

      seenCodes[codeKey] = true;
      seenNames[nameKey] = true;
      Tables.costCenters.insert({
        code: code,
        name: name,
        directorateId: directorateId,
        active: true,
        createdAt: nowIso_(),
      });
      successRows += 1;
    });

    var batch = logImportBatch_('CENTRO_CUSTO', null, importedByEmail, rows.length, successRows, errors);
    return { batch: batch, totalRows: rows.length, successRows: successRows, errors: errors };
  },
};

function normalizeCostCenterLabel_(value) {
  return String(value === null || value === undefined ? '' : value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
