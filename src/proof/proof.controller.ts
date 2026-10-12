import { Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { DatabaseService } from '../database/database.service';
import { FarmScopeService } from '../farms/farm-scope.service';
import { ANCHOR_SERVICE, AnchorService } from './anchor.service';
import { eventLeafData } from './event-leaf';
import { leafHash, merkleProof, merkleRoot, toHex, verifyProof } from './merkle';

@Controller('v1')
export class ProofController {
  constructor(
    private readonly db: DatabaseService,
    private readonly scope: FarmScopeService,
    @Inject(ANCHOR_SERVICE) private readonly anchorService: AnchorService,
  ) {}

  /** Carrega os eventos do lote e recalcula as folhas a partir dos dados ATUAIS do banco. */
  private async recompute(batchId: string) {
    const { rows } = await this.db.query(
      `SELECT i.position, i.event_id, i.leaf AS stored_leaf,
              e.id, e.organization_id, e.farm_id, e.device_id, e.type, e.schema_version, e.occurred_at, e.payload
         FROM proof_batch_items i JOIN sync_events e ON e.id = i.event_id
        WHERE i.batch_id = $1 ORDER BY i.position`,
      [batchId],
    );
    const leaves = rows.map((r) => leafHash(eventLeafData(r)));
    return { rows, leaves };
  }

  /**
   * VERIFICAÇÃO PÚBLICA (alvo do QR code): não expõe nenhum dado de evento, só a prova de integridade.
   * valid = os dados atuais ainda produzem a raiz registrada (e, se houver rede, a raiz ancorada).
   */
  @Public()
  @Get('verify/:batchId')
  async verify(@Param('batchId', ParseUUIDPipe) batchId: string) {
    const { rows: b } = await this.db.query(
      `SELECT id, merkle_root, leaf_count, schema_version, status, anchor_mode, chain_id, tx_ref,
              block_number, anchored_at, created_at
         FROM proof_batches WHERE id = $1`,
      [batchId],
    );
    const batch = b[0];
    if (!batch) throw new NotFoundException('lote não encontrado');

    const { rows, leaves } = await this.recompute(batchId);
    const recomputedRoot = leaves.length ? toHex(merkleRoot(leaves)) : null;
    const tamperedEvents = rows
      .filter((r, i) => toHex(leaves[i]).toLowerCase() !== String(r.stored_leaf).toLowerCase())
      .map((r) => r.event_id);

    const rootMatchesDb = recomputedRoot?.toLowerCase() === String(batch.merkle_root).toLowerCase();

    // Compara também com o que está gravado na rede (quando existe leitura de rede).
    let onChain: { checked: boolean; matches?: boolean; revoked?: boolean } = { checked: false };
    if (batch.status === 'ancorado' && batch.anchor_mode === 'evm') {
      try {
        const chain = await this.anchorService.readAnchor(batchId);
        onChain = chain
          ? {
              checked: true,
              matches: !!recomputedRoot && chain.root.toLowerCase() === recomputedRoot.toLowerCase(),
              revoked: chain.revoked,
            }
          : { checked: true, matches: false };
      } catch {
        onChain = { checked: false }; // rede indisponível não vira "adulterado"
      }
    }

    const valid =
      rootMatchesDb && tamperedEvents.length === 0 && (!onChain.checked || (onChain.matches === true && !onChain.revoked));

    return {
      batchId: batch.id,
      valid,
      status: batch.status,
      merkleRoot: batch.merkle_root,
      recomputedRoot,
      leafCount: batch.leaf_count,
      tamperedEventCount: tamperedEvents.length,
      onChain,
      anchor: {
        mode: batch.anchor_mode,
        chainId: batch.chain_id,
        txRef: batch.tx_ref,
        blockNumber: batch.block_number,
        anchoredAt: batch.anchored_at,
      },
      note:
        batch.anchor_mode === 'mock'
          ? 'Ancoragem SIMULADA: a raiz só existe neste banco; não há prova externa.'
          : undefined,
    };
  }

  /** Lista de lotes da fazenda (dashboard). */
  @Get('proof/batches')
  @Roles('auditor', 'gerente', 'administrador')
  async batches(@CurrentUser() user: AuthUser) {
    const { rows } = await this.db.query(
      `SELECT id, farm_id, merkle_root, leaf_count, status, attempts, last_error, anchor_mode, chain_id,
              tx_ref, block_number, created_at, anchored_at
         FROM proof_batches
        WHERE organization_id = $1 AND ($2::uuid IS NULL OR farm_id = $2)
        ORDER BY created_at DESC LIMIT 100`,
      [user.organizationId, user.farmId],
    );
    return rows;
  }

  /** Prova de inclusão de UM evento (para auditor/certificadora conferir sem refazer o lote inteiro). */
  @Get('proof/batches/:batchId/events/:eventId')
  @Roles('auditor', 'gerente', 'administrador')
  async eventProof(
    @CurrentUser() user: AuthUser,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    const { rows: b } = await this.db.query(
      `SELECT id, farm_id, merkle_root FROM proof_batches WHERE id = $1 AND organization_id = $2`,
      [batchId, user.organizationId],
    );
    if (!b[0]) throw new NotFoundException('lote não encontrado');
    await this.scope.assertFarm(user, b[0].farm_id);

    const { rows, leaves } = await this.recompute(batchId);
    const index = rows.findIndex((r) => r.event_id === eventId);
    if (index < 0) throw new NotFoundException('evento não pertence a este lote');

    const proof = merkleProof(leaves, index);
    return {
      batchId,
      eventId,
      position: index,
      leaf: toHex(leaves[index]),
      merkleRoot: b[0].merkle_root,
      proof,
      // true = a folha RECALCULADA dos dados atuais pertence à raiz registrada
      valid: verifyProof(leaves[index], proof, b[0].merkle_root),
    };
  }
}
