import { NextResponse, type NextRequest } from 'next/server';

/** Sem cookie de sessão, qualquer rota protegida vai para o login. A API valida o token de verdade a cada chamada. */
export function middleware(req: NextRequest) {
  if (!req.cookies.get('ag_token')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Rotas públicas: login, verificação por QR code, autenticação e arquivos estáticos
export const config = {
  matcher: ['/((?!login|verificar|api/auth|_next|favicon\\.ico).*)'],
};
