// Política de Remuneração (tela ADMIN/RH_REMUNERACAO, GET/PUT /remuneration-policy):
// limites globais opcionais que nunca bloqueiam simulação/submissão, só
// sinalizam quando violados (ver policyViolations em MovementSimulation).
// null = sem limite configurado para aquele campo.
export interface RemunerationPolicy {
  maxMeritPercent: number | null;
  maxPromotionPercent: number | null;
  minMonthsBetweenRaises: number | null;
}
