import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

/**
 * Isolamento entre clientes: toda consulta passa por aqui (ou repete o mesmo filtro).
 * Regra: organização do token SEMPRE; se o usuário está preso a uma fazenda, só ela.
 */
@Injectable()
export class FarmScopeService {
  constructor(private readonly db: DatabaseService) {}

  async assertFarm(user: AuthUser, farmId: string): Promise<{ id: string; name: string }> {
    const { rows } = await this.db.query(
      `SELECT id, name FROM farms WHERE id = $1 AND organization_id = $2`,
      [farmId, user.organizationId],
    );
    // Mesma resposta para "não existe" e "é de outra organização": não vaza existência.
    if (!rows[0]) throw new NotFoundException('fazenda não encontrada');
    if (user.farmId && user.farmId !== farmId) throw new ForbiddenException('sem acesso a esta fazenda');
    return rows[0];
  }
}
