import { Role } from "./enums";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  directorateId: string | null;
  /** Só populado para GESTOR — os centros de custo que ele gerencia. */
  costCenterIds: string[] | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// Full user record as returned by GET/POST /users (ADMIN only). The contract
// only spells out the auth payload shape; the extra `active`/timestamps here
// are a judgment call for the admin user-management screen.
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  directorateId: string | null;
  directorateName?: string | null;
  costCenters?: { id: string; code: string; name: string }[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  directorateId?: string | null;
  costCenterIds?: string[];
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: Role;
  directorateId?: string | null;
  costCenterIds?: string[];
  active?: boolean;
}
