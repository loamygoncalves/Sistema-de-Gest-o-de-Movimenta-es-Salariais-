/**
 * Orçamento anual de pessoal — espelha backend/src/modules/budget.
 *
 * Uma linha de orçamento é (ano, diretoria, centro de custo, cargo, tipo de
 * movimentação) + custo orçado mês a mês (jan..dez); NÃO é vinculada a um
 * colaborador (sem matrícula/nome). Múltiplas linhas podem legitimamente
 * repetir a mesma combinação diretoria+centro de custo+cargo+tipo — cada
 * uma representa uma vaga/assento orçado distinto (ex.: 24 linhas
 * idênticas = 24 vagas orçadas daquele tipo). Por isso a importação NUNCA
 * rejeita linha por ser "duplicada".
 */

/** Cabeçalhos aceitos (normalizados) para cada coluna fixa da planilha. */
var BUDGET_HEADER_ALIASES_ = {
  directorate: ['DIRETORIA'],
  costCenter: ['CENTRO DE RESULTADO', 'CENTRO_DE_RESULTADO', 'CENTRO DE CUSTO', 'CENTRO_DE_CUSTO'],
  position: ['CARGO'],
  situation: ['TIPO DE MOVIMENTACAO', 'TIPO_DE_MOVIMENTACAO', 'SITUACAO PLANEJADA', 'SITUACAO_PLANEJADA'],
};

function normalizeBudgetLabel_(value) {
  return String(value === null || value === undefined ? '' : value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function matchesHeaderAlias_(header, aliases) {
  var normalized = normalizeBudgetLabel_(header);
  return aliases.indexOf(normalized) !== -1;
}

function findHeaderIndex_(headers, aliases) {
  for (var i = 0; i < headers.length; i++) {
    if (matchesHeaderAlias_(headers[i], aliases)) return i;
  }
  return -1;
}

/**
 * Lazy on purpose — ver o comentário equivalente em Api.gs: código de nível
 * superior roda na ordem alfabética dos arquivos (BudgetService.gs vem antes
 * de Enums.gs), então montar este mapa fora de uma função quebraria a
 * primeira execução do projeto com "Cannot read properties of undefined".
 *
 * Rótulos aceitos na coluna "TIPO DE MOVIMENTAÇÃO" da planilha de orçamento
 * (com/sem acento, e a própria chave do enum, para round-trip amigável).
 */
function situationAliases_(raw) {
  var map = {};
  map[normalizeBudgetLabel_('SEM_MOVIMENTACAO')] = PlannedSituation.SEM_MOVIMENTACAO;
  map[normalizeBudgetLabel_('SEM MOVIMENTACAO')] = PlannedSituation.SEM_MOVIMENTACAO;
  map[normalizeBudgetLabel_('SEM MOVIMENTAÇÃO')] = PlannedSituation.SEM_MOVIMENTACAO;
  map[normalizeBudgetLabel_('PROMOCAO')] = PlannedSituation.PROMOCAO;
  map[normalizeBudgetLabel_('PROMOÇÃO')] = PlannedSituation.PROMOCAO;
  map[normalizeBudgetLabel_('MERITO')] = PlannedSituation.MERITO;
  map[normalizeBudgetLabel_('MÉRITO')] = PlannedSituation.MERITO;
  map[normalizeBudgetLabel_('SUBSTITUICAO')] = PlannedSituation.SUBSTITUICAO;
  map[normalizeBudgetLabel_('SUBSTITUIÇÃO')] = PlannedSituation.SUBSTITUICAO;
  map[normalizeBudgetLabel_('AUMENTO_DE_QUADRO')] = PlannedSituation.AUMENTO_DE_QUADRO;
  map[normalizeBudgetLabel_('AUMENTO DE QUADRO')] = PlannedSituation.AUMENTO_DE_QUADRO;
  map[normalizeBudgetLabel_('DESLIGAMENTO')] = PlannedSituation.DESLIGAMENTO;
  return map[normalizeBudgetLabel_(raw)];
}

/** Índice 1-based (1=jan..12=dez) -> chave da coluna mensal. */
function monthKeyFromNumber_(month) {
  var key = MONTH_KEYS[month - 1];
  if (!key) throw new Error('Mês inválido: ' + month);
  return key;
}

/** Valor do mês (1-based) de um registro, ou null se a linha não tem custo orçado naquele mês. */
function monthValue_(record, month) {
  var value = record[monthKeyFromNumber_(month)];
  return value === null || value === undefined || value === '' ? null : Number(value);
}

/** Soma os 12 campos mensais (jan..dez) de um registro, ignorando null/undefined. */
function sumAllMonths_(record) {
  return MONTH_KEYS.reduce(function (sum, key) {
    return sum + Number(record[key] || 0);
  }, 0);
}

/**
 * Fator multiplicativo do Ajuste de Orçamento (tela ADMIN) a partir do
 * percentual salvo — sem linha salva, `percent` chega null/undefined e o
 * fator é 1 (100%, sem ajuste).
 */
function budgetAdjustmentFactor_(percent) {
  return percent === null || percent === undefined ? 1 : Number(percent) / 100;
}

/**
 * Escolhe, entre as linhas de Ajuste de Orçamento já salvas para o ano, a
 * mais específica que casa com (directorateId, costCenterId) de uma linha
 * de orçamento — centro de resultado exato dessa diretoria > diretoria
 * inteira > "todos" (ambos vazios na linha de ajuste) — e devolve o fator
 * correspondente (1 = sem ajuste, quando nenhuma linha casa). Espelha
 * resolveBudgetAdjustmentFactor em backend/src/common/utils/months.util.ts.
 * `rows` vêm da aba AjusteOrcamento — directorateId/costCenterId vazios
 * ('') representam "todos"/"sem centro de resultado", nunca null.
 */
function resolveBudgetAdjustmentFactor_(rows, directorateId, costCenterId) {
  directorateId = directorateId || '';
  costCenterId = costCenterId || '';

  if (costCenterId) {
    var costCenterRow = rows.filter(function (r) {
      return (r.directorateId || '') === directorateId && (r.costCenterId || '') === costCenterId;
    })[0];
    if (costCenterRow) return budgetAdjustmentFactor_(costCenterRow.percent);
  }

  if (directorateId) {
    var directorateRow = rows.filter(function (r) {
      return (r.directorateId || '') === directorateId && !r.costCenterId;
    })[0];
    if (directorateRow) return budgetAdjustmentFactor_(directorateRow.percent);
  }

  var globalRow = rows.filter(function (r) {
    return !r.directorateId && !r.costCenterId;
  })[0];
  return budgetAdjustmentFactor_(globalRow ? globalRow.percent : null);
}

var BudgetService = {
  /** Todas as linhas de Ajuste de Orçamento configuradas para o ano, cada uma com seu escopo. */
  listAdjustments: function (year) {
    return Tables.budgetAdjustments.where(function (a) { return Number(a.year) === Number(year); });
  },

  /**
   * Fator do Ajuste de Orçamento aplicável a uma linha de orçamento
   * (diretoria + centro de resultado) — a regra mais específica que casar
   * vence (ver resolveBudgetAdjustmentFactor_). Nunca à contagem de HC/
   * vagas orçadas, e nunca gravado sobre budget_entries (ver AjusteOrcamento).
   */
  getAdjustmentFactor_: function (year, directorateId, costCenterId) {
    var rows = this.listAdjustments(year);
    return resolveBudgetAdjustmentFactor_(rows, directorateId, costCenterId);
  },

  /**
   * Salva (cria ou substitui) uma linha do Ajuste de Orçamento — identificada
   * por (year, directorateId, costCenterId); ambos vazios = escopo "todos".
   * Só ADMIN (ver Api.gs).
   */
  saveAdjustment: function (input) {
    var directorateId = input.directorateId || '';
    var costCenterId = input.costCenterId || '';
    var row = Tables.budgetAdjustments.where(function (a) {
      return (
        Number(a.year) === Number(input.year) &&
        (a.directorateId || '') === directorateId &&
        (a.costCenterId || '') === costCenterId
      );
    })[0];
    if (row) {
      return Tables.budgetAdjustments.update(row.id, { percent: Number(input.percent), updatedAt: nowIso_() });
    }
    return Tables.budgetAdjustments.insert({
      year: Number(input.year),
      directorateId: directorateId,
      costCenterId: costCenterId,
      percent: Number(input.percent),
      updatedAt: nowIso_(),
    });
  },

  /** Remove uma linha do Ajuste de Orçamento — o escopo dela volta a 100% (sem ajuste). Só ADMIN (ver Api.gs). */
  removeAdjustment: function (id) {
    Tables.budgetAdjustments.remove(id);
    return { ok: true };
  },

  listEntries: function (year, scope, positionId) {
    scope = scope || {};
    return Tables.budgetEntries.where(function (b) {
      if (Number(b.year) !== Number(year)) return false;
      if (!matchesAccessScope_(b, scope)) return false;
      if (positionId && b.positionId !== positionId) return false;
      return true;
    });
  },

  /**
   * HC/folha orçados no mês de referência (padrão: mês corrente) — conta uma
   * linha como "HC orçado" naquele mês quando ela tem custo orçado (não
   * nulo) no mês, e soma esse custo para a folha orçada. `annualBudgeted` é
   * a soma de todas as 12 colunas de todas as linhas (visão do ano inteiro).
   */
  getDashboard: function (year, month, scope) {
    var referenceMonth = month || new Date().getMonth() + 1;
    var entries = this.listEntries(year, scope);
    var adjustmentRows = this.listAdjustments(year);
    var factorFor = function (entry) {
      return resolveBudgetAdjustmentFactor_(adjustmentRows, entry.directorateId, entry.costCenterId);
    };

    var activeEntries = entries.filter(function (entry) {
      return monthValue_(entry, referenceMonth) !== null;
    });
    var hcBudgeted = activeEntries.length;
    var payrollBudgeted = activeEntries.reduce(function (sum, entry) {
      return sum + Number(monthValue_(entry, referenceMonth) || 0) * factorFor(entry);
    }, 0);
    var annualBudgeted = entries.reduce(function (sum, entry) {
      return sum + sumAllMonths_(entry) * factorFor(entry);
    }, 0);

    return {
      year: year,
      month: referenceMonth,
      hcBudgeted: hcBudgeted,
      payrollBudgeted: payrollBudgeted,
      annualBudgeted: annualBudgeted,
    };
  },

  /**
   * Importa o orçamento anual a partir da planilha "diretoria + centro de
   * custo + cargo + tipo de movimentação + jan..dez". As 4 primeiras colunas
   * são identificadas pelo nome do cabeçalho (aceita variações com/sem
   * acento); as 12 colunas seguintes são lidas por posição, na ordem em que
   * aparecem, e mapeadas para jan..dez — a data do primeiro cabeçalho de mês
   * (quando é uma data de verdade) define o ano, sobrepondo o parâmetro
   * `year` se ele não bater. Reimportar substitui integralmente o orçado do
   * ano para as diretorias presentes no arquivo (em vez de acumular linhas
   * antigas); não há rejeição de linha "duplicada" — cada linha válida vira
   * uma vaga orçada distinta.
   */
  importFromFile: function (base64Data, mimeType, filename, yearParam, importedByEmail) {
    var sheet = parseUploadedSpreadsheetRaw_(base64Data, mimeType, filename);
    var headers = sheet.headers;
    var rows = sheet.rows;

    var colIndex = {
      directorate: findHeaderIndex_(headers, BUDGET_HEADER_ALIASES_.directorate),
      costCenter: findHeaderIndex_(headers, BUDGET_HEADER_ALIASES_.costCenter),
      position: findHeaderIndex_(headers, BUDGET_HEADER_ALIASES_.position),
      situation: findHeaderIndex_(headers, BUDGET_HEADER_ALIASES_.situation),
    };

    var missing = [];
    Object.keys(colIndex).forEach(function (key) {
      if (colIndex[key] === -1) missing.push(key);
    });
    if (missing.length > 0) {
      throw new Error(
        'Planilha inválida: coluna(s) não encontrada(s): ' +
          missing.join(', ') +
          '. Esperado: DIRETORIA, CENTRO DE RESULTADO, CARGO, TIPO DE MOVIMENTAÇÃO, seguidas de 12 colunas de meses (jan a dez).',
      );
    }

    var fixedCols = {};
    Object.keys(colIndex).forEach(function (key) {
      fixedCols[colIndex[key]] = true;
    });

    var monthColumns = [];
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] === undefined || headers[i] === null || headers[i] === '') continue;
      if (fixedCols[i]) continue;
      monthColumns.push(i);
    }

    if (monthColumns.length !== 12) {
      throw new Error(
        'Planilha inválida: esperadas 12 colunas de meses (jan a dez) após as colunas fixas, encontradas ' +
          monthColumns.length +
          '.',
      );
    }

    var year = yearParam;
    var firstHeader = headers[monthColumns[0]];
    if (firstHeader instanceof Date) {
      year = firstHeader.getFullYear();
    }

    var errors = [];
    var successRows = 0;
    var toInsert = [];

    rows.forEach(function (row) {
      var directorateName = String(row.values[colIndex.directorate] || '').trim();
      var costCenterName = String(row.values[colIndex.costCenter] || '').trim();
      var positionName = String(row.values[colIndex.position] || '').trim();
      var situationRaw = String(row.values[colIndex.situation] || '').trim();

      function fail(field, message) {
        errors.push({ rowNumber: row.rowNumber, field: field, message: message });
      }

      if (!directorateName) return fail('diretoria', 'Diretoria é obrigatória');
      if (!costCenterName) return fail('centro_de_custo', 'Centro de resultado é obrigatório');
      if (!positionName) return fail('cargo', 'Cargo é obrigatório');

      var movementType = situationAliases_(situationRaw);
      if (!movementType) return fail('tipo_de_movimentacao', 'Tipo de movimentação inválido: ' + situationRaw);

      var directorate = OrgService.findDirectorateByName(directorateName);
      if (!directorate) return fail('diretoria', 'Diretoria inexistente: ' + directorateName);
      var costCenter = OrgService.findCostCenterByName(costCenterName);
      if (!costCenter) return fail('centro_de_custo', 'Centro de resultado inexistente: ' + costCenterName);
      var position = OrgService.findPositionByName(positionName);
      if (!position) return fail('cargo', 'Cargo inexistente: ' + positionName);

      var monthValues = {};
      var invalidMonth = null;
      monthColumns.forEach(function (colNumber, idx) {
        var raw = row.values[colNumber];
        var key = MONTH_KEYS[idx];
        if (
          raw === undefined ||
          raw === null ||
          raw === '' ||
          String(raw).trim() === '' ||
          String(raw).trim() === '-'
        ) {
          monthValues[key] = null;
          return;
        }
        var parsed = toNumber_(raw);
        if (parsed === null) {
          invalidMonth = key + ': "' + raw + '"';
          return;
        }
        monthValues[key] = parsed;
      });
      if (invalidMonth) return fail('meses', 'Valor mensal inválido em ' + invalidMonth);

      var payload = {
        year: year,
        directorateId: directorate.id,
        costCenterId: costCenter.id,
        positionId: position.id,
        movementType: movementType,
        createdAt: nowIso_(),
        updatedAt: nowIso_(),
      };
      MONTH_KEYS.forEach(function (key) {
        payload[key] = monthValues[key];
      });
      toInsert.push(payload);
      successRows += 1;
    });

    var batch = logImportBatch_('ORCAMENTO', year, importedByEmail, rows.length, successRows, errors);

    if (toInsert.length > 0) {
      var directorateIds = {};
      toInsert.forEach(function (entry) {
        entry.importBatchId = batch.id;
        directorateIds[entry.directorateId] = true;
      });

      // Substitui integralmente o orçado do ano por diretoria/centro de
      // custo/cargo/tipo: uma reimportação corrige a planilha inteira em
      // vez de acumular linhas antigas.
      var toRemove = Tables.budgetEntries.where(function (b) {
        return Number(b.year) === Number(year) && directorateIds.hasOwnProperty(b.directorateId);
      });
      toRemove.forEach(function (b) {
        Tables.budgetEntries.remove(b.id);
      });
      toInsert.forEach(function (payload) {
        Tables.budgetEntries.insert(payload);
      });
    }

    return { batch: batch, totalRows: rows.length, successRows: successRows, errors: errors };
  },
};

function sumBy_(records, field) {
  return records.reduce(function (sum, r) {
    return sum + Number(r[field] || 0);
  }, 0);
}

function round2_(value) {
  return Math.round(value * 100) / 100;
}
