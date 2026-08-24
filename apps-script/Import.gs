/**
 * Utilitários de importação de planilhas — equivalente a
 * backend/src/common/utils/excel.util.ts. Aceita CSV diretamente
 * (Utilities.parseCsv) e XLSX via conversão pelo Google Drive (exige o
 * serviço avançado "Drive API" habilitado no projeto — ver README).
 */

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Recebe o conteúdo de um arquivo enviado pelo navegador (base64 + MIME
 * type, como o `<input type="file">` entrega via FileReader no cliente) e
 * devolve linhas normalizadas: [{ rowNumber, data: {campo: valor} }, ...].
 * `rowNumber` é 1-based contando o cabeçalho como linha 1 (a primeira linha
 * de dados é a 2), igual ao que o usuário vê ao abrir a planilha.
 */
function parseUploadedSpreadsheet_(base64Data, mimeType, filename) {
  var rows;
  if (mimeType === 'text/csv' || /\.csv$/i.test(filename || '')) {
    var text = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename).getDataAsString('UTF-8');
    rows = Utilities.parseCsv(text);
  } else {
    rows = readXlsxViaDriveConversion_(base64Data, mimeType, filename);
  }
  return rowsToRecords_(rows);
}

function readXlsxViaDriveConversion_(base64Data, mimeType, filename) {
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
  var tempFile = Drive.Files.create(
    { name: 'sgms-import-temp-' + newId_(), mimeType: MimeType.GOOGLE_SHEETS },
    blob,
    { fields: 'id' },
  );
  try {
    var ss = SpreadsheetApp.openById(tempFile.id);
    var sheet = ss.getSheets()[0];
    return sheet.getDataRange().getValues();
  } finally {
    Drive.Files.remove(tempFile.id);
  }
}

function rowsToRecords_(rows) {
  if (!rows || rows.length === 0) return [];
  var headers = rows[0].map(normalizeHeader_);
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var hasValue = row.some(function (v) {
      return v !== '' && v !== null && v !== undefined;
    });
    if (!hasValue) continue;
    var data = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) data[headers[c]] = row[c];
    }
    out.push({ rowNumber: i + 1, data: data });
  }
  return out;
}

function toNumber_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  var normalized = String(value)
    .trim()
    .replace(/R\$\s?/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');
  var parsed = Number(normalized);
  return isNaN(parsed) ? null : parsed;
}

function toDateIso_(value) {
  if (!value) return null;
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function logImportBatch_(type, referenceYear, importedByEmail, totalRows, successRows, errors) {
  return Tables.importLog.insert({
    type: type,
    referenceYear: referenceYear || '',
    importedByEmail: importedByEmail,
    totalRows: totalRows,
    successRows: successRows,
    errorRows: errors.length,
    errorsJson: JSON.stringify(errors),
    createdAt: nowIso_(),
  });
}
