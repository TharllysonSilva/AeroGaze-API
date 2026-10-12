import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './decorators';
import { AuthUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('token ausente');

    try {
      const p = await this.jwt.verifyAsync<JwtPayload>(token);
      const user: AuthUser = {
        id: p.sub,
        organizationId: p.org,
        farmId: p.farm,
        role: p.role,
        name: p.name,
        email: p.email,
      };
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('token inválido ou expirado');
    }
  }
}
