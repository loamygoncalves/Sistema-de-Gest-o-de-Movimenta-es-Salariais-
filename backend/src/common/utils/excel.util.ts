import * as ExcelJS from 'exceljs';

/**
 * Lê a primeira planilha de um buffer .xlsx e retorna linhas como objetos
 * chaveados pelo cabeçalho normalizado (minúsculo, sem acento, snake_case),
 * na ordem em que aparecem no arquivo. `rowNumber` é 1-based e considera a
 * linha de cabeçalho (linha 1), então a primeira linha de dados é 2 — o que
 * corresponde ao que um usuário vê ao abrir o Excel.
 */
export interface ParsedExcelRow {
  rowNumber: number;
  data: Record<string, any>;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
}

export async function parseExcelBuffer(buffer: Buffer): Promise<ParsedExcelRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeHeader(cell.value);
  });

  const rows: ParsedExcelRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const data: Record<string, any> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      let value: any = cell.value;
      if (value && typeof value === 'object' && 'text' in value) {
        value = (value as any).text;
      }
      if (value && typeof value === 'object' && 'result' in value) {
        value = (value as any).result;
      }
      if (value !== null && value !== undefined && value !== '') hasValue = true;
      data[key] = value;
    });
    if (hasValue) rows.push({ rowNumber, data });
  });

  return rows;
}

export async function buildExcelBuffer(
  sheetName: string,
  columns: { header: string; key: string; width?: number }[],
  rows: Record<string, any>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns as any;
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const normalized = String(value)
    .trim()
    .replace(/R\$\s?/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
