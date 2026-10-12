import { canonicalize } from './canonical-json';

/** Campos que entram no hash de cada evento. Mudou qualquer um deles depois, a prova falha. */
export interface LeafSource {
  id: string;
  organization_id: string;
  farm_id: string;
  device_id: string;
  type: string;
  schema_version: number;
  occurred_at: Date | string;
  payload: unknown;
}

export function eventLeafData(e: LeafSource): string {
  return canonicalize({
    id: e.id,
    organizationId: e.organization_id,
    farmId: e.farm_id,
    deviceId: e.device_id,
    type: e.type,
    schemaVersion: e.schema_version,
    occurredAt: new Date(e.occurred_at).toISOString(),
    payload: e.payload,
  });
}
