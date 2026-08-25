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

export interface RawExcelSheet {
  /** Valores brutos da linha de cabeçalho (linha 1), 1-based (índice 0 vazio). */
  headers: any[];
  /** Uma entrada por linha de dados, com os valores brutos de cada coluna (1-based, índice 0 vazio). */
  rows: { rowNumber: number; values: any[] }[];
}

/**
 * Lê a primeira planilha preservando os valores brutos por posição de
 * coluna (sem normalizar nomes de cabeçalho) — usado quando o layout tem
 * colunas cujo cabeçalho não é um texto simples (ex.: datas de cada mês no
 * orçamento) e o mapeamento precisa ser feito pelo chamador.
 */
export async function parseExcelSheetRaw(buffer: Buffer): Promise<RawExcelSheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], rows: [] };

  function cellValue(cell: ExcelJS.Cell): any {
    let value: any = cell.value;
    if (value && typeof value === 'object' && 'text' in value) value = (value as any).text;
    if (value && typeof value === 'object' && 'result' in value) value = (value as any).result;
    return value;
  }

  const headers: any[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = cellValue(cell);
  });

  const rows: { rowNumber: number; values: any[] }[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: any[] = [];
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const value = cellValue(cell);
      if (value !== null && value !== undefined && value !== '') hasValue = true;
      values[colNumber] = value;
    });
    if (hasValue) rows.push({ rowNumber, values });
  });

  return { headers, rows };
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

/**
 * Extrai {year, month} de uma coluna "mês de referência" — aceita "MM/AAAA"
 * (texto) ou uma data (caso o Excel converta a célula automaticamente, ex.:
 * célula formatada como data). Usado pelo fechamento mensal da folha (ver
 * EmployeesService#importFromExcel).
 */
export function toMonthYear(value: any): { year: number; month: number } | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { year: value.getFullYear(), month: value.getMonth() + 1 };
  }
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}
