import { Inject, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AppEnv, ENV_TOKEN } from '../config/env';
import { GeofenceService } from './geofence.service';

export interface RuleContext {
  eventId: string;
  organizationId: string;
  farmId: string;
  plotId: string | null;
  type: string;
  payload: Record<string, any>;
}

export interface RuleOutcome {
  alerts: number;
  tasks: number;
}

/**
 * Motor de regras do MVP. Roda DENTRO da mesma transação que grava o evento:
 * se qualquer passo falhar, nada fica pela metade (nem evento sem alerta, nem alerta sem evento).
 */
@Injectable()
export class RulesService {
  constructor(private readonly geofence: GeofenceService, @Inject(ENV_TOKEN) private readonly env: AppEnv) {}

  async evaluate(client: PoolClient, ctx: RuleContext): Promise<RuleOutcome> {
    switch (ctx.type) {
      case 'inspection.recorded':
        return this.inspectionRule(client, ctx);
      case 'position.reported':
        return this.geofenceRule(client, ctx);
      default:
        return { alerts: 0, tasks: 0 };
    }
  }

  // RG-IA-01: inferência local (TFLite) -> alerta e tarefa, com saída "inconclusivo" -> revisão humana
  private async inspectionRule(client: PoolClient, ctx: RuleContext): Promise<RuleOutcome> {
    const ai = ctx.payload?.ai as { label?: string; confidence?: number; modelVersion?: string } | undefined;
    if (!ai?.label) return { alerts: 0, tasks: 0 };

    const label = String(ai.label);
    const confidence = Number(ai.confidence ?? 0);
    if (label === 'saudavel') return { alerts: 0, tasks: 0 };

    if (label === 'inconclusivo' || confidence < this.env.aiAlertMinConfidence) {
      await this.createTask(client, ctx, null, {
        title: 'Revisão humana de inspeção',
        description: `A IA não concluiu com segurança (resultado: ${label}, confiança ${confidence.toFixed(2)}). Conferir em campo.`,
        priority: 'media',
      });
      return { alerts: 0, tasks: 1 };
    }

    const alertId = await this.createAlert(client, ctx, {
      rule: 'RG-IA-01',
      severity: 'alta',
      title: `Possível ${label.replace(/_/g, ' ')} detectado`,
      details: { label, confidence, modelVersion: ai.modelVersion ?? null },
      dedupeKey: `ia:${ctx.farmId}:${ctx.plotId ?? 'sem-talhao'}:${label}`,
    });
    if (!alertId) return { alerts: 0, tasks: 0 }; // já existe alerta aberto igual: não duplica

    await this.createTask(client, ctx, alertId, {
      title: `Inspeção de confirmação: ${label.replace(/_/g, ' ')}`,
      description: 'Confirmar em campo o achado da IA e registrar o tratamento aplicado.',
      priority: 'alta',
    });
    return { alerts: 1, tasks: 1 };
  }

  // RG-GEO-01: perímetro georreferenciado (leituras consecutivas + precisão + margem + permanência)
  private async geofenceRule(client: PoolClient, ctx: RuleContext): Promise<RuleOutcome> {
    const assetId = ctx.payload?.assetId ? String(ctx.payload.assetId) : null;
    if (!assetId) return { alerts: 0, tasks: 0 };

    const violated = await this.geofence.isSustainedViolation(client, ctx.farmId, assetId);
    if (!violated) return { alerts: 0, tasks: 0 };

    const alertId = await this.createAlert(client, ctx, {
      rule: 'RG-GEO-01',
      severity: 'alta',
      title: `Ativo ${assetId} fora do perímetro`,
      details: { assetId },
      dedupeKey: `geo:${ctx.farmId}:${assetId}`,
    });
    if (!alertId) return { alerts: 0, tasks: 0 };

    await this.createTask(client, ctx, alertId, {
      title: `Localizar ativo ${assetId}`,
      description: 'O ativo permaneceu fora do perímetro em leituras consecutivas e precisas.',
      priority: 'alta',
    });
    return { alerts: 1, tasks: 1 };
  }

  private async createAlert(
    client: PoolClient,
    ctx: RuleContext,
    a: { rule: string; severity: string; title: string; details: object; dedupeKey: string },
  ): Promise<string | null> {
    const { rows } = await client.query(
      `INSERT INTO alerts (organization_id, farm_id, plot_id, source_event_id, rule, severity, title, details, dedupe_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'aberto' DO NOTHING
       RETURNING id`,
      [ctx.organizationId, ctx.farmId, ctx.plotId, ctx.eventId, a.rule, a.severity, a.title, JSON.stringify(a.details), a.dedupeKey],
    );
    return rows[0]?.id ?? null;
  }

  private async createTask(
    client: PoolClient,
    ctx: RuleContext,
    alertId: string | null,
    t: { title: string; description: string; priority: string },
  ) {
    await client.query(
      `INSERT INTO tasks (organization_id, farm_id, plot_id, alert_id, source_event_id, title, description, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ctx.organizationId, ctx.farmId, ctx.plotId, alertId, ctx.eventId, t.title, t.description, t.priority],
    );
  }
}
