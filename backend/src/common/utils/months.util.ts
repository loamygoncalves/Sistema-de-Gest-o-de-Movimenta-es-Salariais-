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

export interface BudgetAdjustmentRow {
  directorateId: string | null;
  costCenterId: string | null;
  percent: number;
}

/**
 * Escolhe, entre as linhas de Ajuste de Orçamento já salvas para o ano, a
 * mais específica que casa com (directorateId, costCenterId) de uma linha
 * de orçamento — centro de resultado exato dessa diretoria > diretoria
 * inteira > "todos" (ambos null na linha de ajuste) — e devolve o fator
 * correspondente (1 = sem ajuste, quando nenhuma linha casa). Compartilhado
 * por BudgetService/DashboardService/EmployeesService/SimulatorService para
 * a mesma precedência não divergir entre os consumidores.
 */
export function resolveBudgetAdjustmentFactor(
  rows: BudgetAdjustmentRow[],
  directorateId: string | null | undefined,
  costCenterId: string | null | undefined,
): number {
  if (costCenterId != null) {
    const costCenterRow = rows.find(
      (r) => r.directorateId === directorateId && r.costCenterId === costCenterId,
    );
    if (costCenterRow) return budgetAdjustmentFactor(costCenterRow.percent);
  }

  if (directorateId != null) {
    const directorateRow = rows.find((r) => r.directorateId === directorateId && r.costCenterId === null);
    if (directorateRow) return budgetAdjustmentFactor(directorateRow.percent);
  }

  const globalRow = rows.find((r) => r.directorateId === null && r.costCenterId === null);
  return budgetAdjustmentFactor(globalRow?.percent);
}
