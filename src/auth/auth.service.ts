import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { JwtPayload, Role } from './auth.types';

// Hash descartável: gasta o mesmo tempo quando o e-mail não existe (evita enumerar usuários).
const DUMMY_HASH = bcrypt.hashSync('descartavel-aerogaze', 10);

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService, private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const { rows } = await this.db.query(
      `SELECT id, organization_id, farm_id, email, name, password_hash, role, active
         FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    const user = rows[0];
    const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !user.active || !ok) throw new UnauthorizedException('credenciais inválidas');

    const payload: JwtPayload = {
      sub: user.id,
      org: user.organization_id,
      farm: user.farm_id,
      role: user.role as Role,
      name: user.name,
      email: user.email,
    };
    const accessToken = await this.jwt.signAsync(payload);

    await this.db.query(
      `INSERT INTO audit_log (organization_id, user_id, action, entity, entity_id) VALUES ($1,$2,'auth.login','user',$3)`,
      [user.organization_id, user.id, String(user.id)],
    );

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, farmId: user.farm_id },
    };
  }
}
