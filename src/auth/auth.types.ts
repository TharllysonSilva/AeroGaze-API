export type Role = 'operador' | 'veterinario' | 'gerente' | 'auditor' | 'administrador';

export interface AuthUser {
  id: string;
  organizationId: string;
  /** null = enxerga todas as fazendas da organização */
  farmId: string | null;
  role: Role;
  name: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  org: string;
  farm: string | null;
  role: Role;
  name: string;
  email: string;
}
