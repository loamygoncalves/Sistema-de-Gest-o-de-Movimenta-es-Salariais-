import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../enums';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  directorateId: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/** Perfis com escopo restrito à própria diretoria (não enxergam toda a empresa). */
export const SCOPED_ROLES = [UserRole.DIRETOR, UserRole.GESTOR];

export function isScopedToOwnDirectorate(user: AuthenticatedUser): boolean {
  return SCOPED_ROLES.includes(user.role);
}
