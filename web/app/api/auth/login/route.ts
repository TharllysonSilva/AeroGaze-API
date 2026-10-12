import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { COOKIE_TOKEN, COOKIE_USER, encodeUser } from '@/lib/session';

const TWELVE_HOURS = 60 * 60 * 12;

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || !password) return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 });

  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  }).catch(() => null);

  if (!res) return NextResponse.json({ error: 'API indisponível. Tente novamente em instantes.' }, { status: 502 });
  if (res.status === 401) return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
  if (!res.ok) return NextResponse.json({ error: 'Não foi possível entrar' }, { status: 502 });

  const data = (await res.json()) as {
    accessToken: string;
    user: { id: string; name: string; email: string; role: any; farmId: string | null };
  };

  const jar = await cookies();
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TWELVE_HOURS };
  jar.set(COOKIE_TOKEN, data.accessToken, base);
  jar.set(COOKIE_USER, encodeUser(data.user), base);
  return NextResponse.json({ ok: true });
}
