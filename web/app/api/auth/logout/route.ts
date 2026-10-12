import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE_TOKEN, COOKIE_USER } from '@/lib/session';

async function clear(req: Request) {
  const jar = await cookies();
  jar.delete(COOKIE_TOKEN);
  jar.delete(COOKIE_USER);
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}

export const GET = clear;
export const POST = clear;
