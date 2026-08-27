import { MONTH_KEYS, MonthKey } from '../enums';

/** Índice 1-based (1=jan..12=dez) -> chave da coluna mensal. */
export function monthKeyFromNumber(month: number): MonthKey {
  const key = MONTH_KEYS[month - 1];
  if (!key) throw new Error(`Mês inválido: ${month}`);
  return key;
}

/** Soma os 12 campos mensais (jan..dez) de um registro, ignorando null/undefined. */
export function sumAllMonths(record: Record<MonthKey, number | null | undefined>): number {
  return MONTH_KEYS.reduce((sum, key) => sum + Number(record[key] ?? 0), 0);
}

/** Valor do mês (1-based) de um registro, ou null se a linha não tem custo orçado naquele mês. */
export function monthValue(
  record: Record<MonthKey, number | null | undefined>,
  month: number,
): number | null {
  const value = record[monthKeyFromNumber(month)];
  return value === null || value === undefined ? null : Number(value);
}

/** true se a linha tem custo orçado (não nulo) no mês (1-based) informado. */
export function isActiveInMonth(
  record: Record<MonthKey, number | null | undefined>,
  month: number,
): boolean {
  return monthValue(record, month) !== null;
}

/**
 * Fator multiplicativo do Ajuste de Orçamento (tela ADMIN) a partir do
 * percentual salvo para o ano — sem linha salva, `percent` chega `null`/
 * `undefined` e o fator é 1 (100%, sem ajuste).
 */
export function budgetAdjustmentFactor(percent: number | null | undefined): number {
  return percent === null || percent === undefined ? 1 : Number(percent) / 100;
}
