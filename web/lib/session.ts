import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role, SessionUser } from './types';

export const COOKIE_TOKEN = 'ag_token';
export const COOKIE_USER = 'ag_user';

export const encodeUser = (u: SessionUser) => Buffer.from(JSON.stringify(u), 'utf8').toString('base64url');

export async function getSession(): Promise<SessionUser | null> {
  const raw = (await cookies()).get(COOKIE_USER)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as SessionUser;
  } catch {
    return null;
  }
}

/** Garante sessão válida; sem ela, limpa os cookies e volta ao login. */
export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect('/api/auth/logout');
  return s;
}

/** Barra quem não tem o papel (a API também barra; isto evita telas vazias ou de erro). */
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const s = await requireSession();
  if (!roles.includes(s.role)) redirect('/comando');
  return s;
}
