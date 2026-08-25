import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../enums';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  directorateId: string | null;
  /** Só populado para GESTOR — a lista de centros de custo que ele gerencia. */
  costCenterIds: string[] | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Escopo de acesso do usuário: DIRETOR enxerga a diretoria inteira,
 * GESTOR enxerga só os centros de custo atribuídos a ele, os demais perfis
 * (ADMIN, RH_REMUNERACAO) não têm escopo restrito. Nunca ambos os campos ao
 * mesmo tempo.
 */
export interface AccessScope {
  directorateId?: string;
  costCenterIds?: string[];
}

export function resolveAccessScope(user: AuthenticatedUser): AccessScope {
  if (user.role === UserRole.DIRETOR) {
    return user.directorateId ? { directorateId: user.directorateId } : {};
  }
  if (user.role === UserRole.GESTOR) {
    return { costCenterIds: user.costCenterIds ?? [] };
  }
  return {};
}
