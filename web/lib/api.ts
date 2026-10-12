import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_TOKEN } from './session';

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = (await cookies()).get(COOKIE_TOKEN)?.value;
  if (!token) redirect('/api/auth/logout');

  const res = await fetch(`${API_URL}${path}`, {
    method,
    cache: 'no-store',
    signal: AbortSignal.timeout(45000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) redirect('/api/auth/logout'); // token expirado: volta ao login
  if (!res.ok) throw new ApiError(res.status, `API ${method} ${path} respondeu ${res.status}`);
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => call<T>('GET', path);
export const apiSend = <T>(method: 'PATCH' | 'POST', path: string, body: unknown) => call<T>(method, path, body);

/** LÃª um recurso opcional: se o papel nÃ£o tem acesso (403/404), devolve o valor padrÃ£o em vez de quebrar a tela. */
export async function apiGetOr<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (e) {
    if (e instanceof ApiError && [403, 404].includes(e.status)) return fallback;
    throw e; // inclui o redirect do Next
  }
}

/** Chamada pÃºblica (sem token), usada pela verificaÃ§Ã£o do QR code. */
export async function apiPublicGet<T>(path: string): Promise<T | null> {
  let res: Response;
  try { res = await fetch(`${API_URL}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(45000) }); }
  catch { throw new ApiError(502, 'API indisponível'); }
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, 'Consulta pública indisponível');
  return (await res.json()) as T;
}
