import { SelectQueryBuilder } from 'typeorm';
import { AccessScope } from '../decorators/current-user.decorator';

/**
 * Aplica o escopo de acesso do usuário (ver AccessScope) a uma query
 * `SelectQueryBuilder` que já tenha as colunas `<alias>.directorateId` e
 * `<alias>.costCenterId`. DIRETOR fixa a diretoria; GESTOR fixa a lista de
 * centros de custo (vazio = não vê nada, nunca "vê tudo" por omissão).
 * Quando o usuário não tem escopo restrito, os filtros explícitos vindos da
 * query string (`queryDirectorateId`/`queryCostCenterId`) continuam valendo.
 */
export function applyAccessScope(
  qb: SelectQueryBuilder<any>,
  alias: string,
  scope: AccessScope,
  queryDirectorateId?: string,
  queryCostCenterId?: string,
): void {
  const directorateId = scope.directorateId ?? queryDirectorateId;
  if (directorateId) {
    qb.andWhere(`${alias}.directorateId = :scopeDirectorateId`, { scopeDirectorateId: directorateId });
  }

  if (scope.costCenterIds) {
    if (scope.costCenterIds.length === 0) {
      qb.andWhere('1 = 0');
    } else {
      qb.andWhere(`${alias}.costCenterId IN (:...scopeCostCenterIds)`, {
        scopeCostCenterIds: scope.costCenterIds,
      });
    }
  } else if (queryCostCenterId) {
    qb.andWhere(`${alias}.costCenterId = :scopeCostCenterId`, { scopeCostCenterId: queryCostCenterId });
  }
}
